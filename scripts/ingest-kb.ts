/**
 * Loads the built knowledge base (kb/) into the shared legal corpus tables.
 *
 * Usage (Node 24 runs TypeScript directly):
 *   node --env-file=.env.local scripts/ingest-kb.ts            dry run: print what would be loaded
 *   node --env-file=.env.local scripts/ingest-kb.ts --apply    write to legal_sources / legal_chunks
 *   ... --apply --allow-draft                                   also allow a non-production (drafts included) build
 *
 * Input: `${KB_DIST_DIR}/manifest.json` and `${KB_DIST_DIR}/corpus.jsonl`, produced by
 * `pnpm --dir kb build` (demo) or `pnpm --dir kb build:prod` (approved items only).
 * The app never imports from kb/; this built output is the only contract between them.
 *
 * AGENTS.md §0 note: `--apply` uses the service-role key. That is allowed here because this is an
 * operator-run command-line admin tool: it is not imported by the app, not reachable from any route,
 * server action, Inngest function or user input, and it writes only the shared legal corpus
 * (legal_sources / legal_chunks), which users can read but never write. It never reads or writes
 * building-scoped data. Do not import this file from app code, and do not move this logic into a
 * request path.
 *
 * Only law-layer items are loaded. Firm, building and topic items are listed and skipped until we
 * decide where they live (kb/research/open-questions.md, question 7).
 *
 * Refreshing. Each source is keyed by its kb id (legal_sources.kb_id), so re-running updates a
 * source instead of duplicating it. A source whose chunk content is unchanged keeps its embeddings:
 * re-embedding the corpus is slow and costs money (AGENTS.md section 5), so only changed sources are
 * re-embedded. The kb is the source of truth for in_force_to and supersedes, which is what makes a
 * point-in-time question work: hybrid_search_legal will not return a source whose in_force_to has
 * passed. Sources in the database whose kb id is absent from the build are reported and left alone,
 * never deleted: an item leaving a build is not a repeal, and deciding what it means is a person's
 * job (the same rule kb/tools/import-bclaws.ts follows for sections that disappear from BC Laws).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const ChunkSchema = z.object({
  chunk_id: z.string().min(1),
  section_ref: z.string().nullable(),
  heading: z.string().nullable(),
  content: z.string().min(1),
});

const ItemSchema = z.object({
  id: z.string().min(1),
  layer: z.enum(['law', 'firm', 'building', 'topic']),
  type: z.string().min(1),
  title: z.string().min(1),
  citation: z.string().nullable(),
  jurisdiction: z.string().min(1),
  source_url: z.string().nullable(),
  in_force_from: z.string().nullable(),
  in_force_to: z.string().nullable(),
  retrieved_at: z.string().nullable(),
  licence: z.string().min(1),
  supersedes: z.string().nullable(),
  status: z.enum(['draft', 'reviewed', 'approved']),
  path: z.string(),
  chunks: z.array(ChunkSchema),
});
type Item = z.infer<typeof ItemSchema>;

const ManifestSchema = z.object({
  kb_version: z.string(),
  built_at: z.string(),
  production: z.boolean(),
  status_filter: z.string(),
  corpus_sha256: z.string(),
});

const ApplyEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LEGAL_CORPUS_INGEST_ENABLED: z.literal('true', {
    message: 'LEGAL_CORPUS_INGEST_ENABLED must be "true" (written approval required)',
  }),
  VOYAGE_API_KEY: z.string().min(1),
});

/**
 * Must stay identical to lib/ai/models.ts MODEL_IDS.embedding and the vector width of
 * legal_chunks.embedding. A query is embedded at retrieval time with the same model, so a mismatch
 * here does not fail loudly — it quietly returns nonsense. The width is asserted at runtime below.
 * This file cannot import lib/ai/models.ts: that module is 'server-only'.
 */
const EMBEDDING_MODEL = 'voyage-law-2';
const EMBEDDING_DIMENSIONS = 1024;

/** The same contextual header the building corpus uses (lib/ai/chunking.ts contextualText). */
function contextualText(item: Item, chunk: z.infer<typeof ChunkSchema>): string {
  return `[${item.title} · effective ${item.in_force_from ?? 'unverified'}]\n[${chunk.heading ?? chunk.section_ref ?? ''}]\n${chunk.content}`;
}

/** Hash of what was loaded for a source, so an unchanged source is not re-embedded. */
function contentHash(item: Item): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        item.title,
        item.citation,
        item.in_force_from,
        item.in_force_to,
        item.chunks.map((c) => [c.section_ref, c.heading, c.content]),
      ]),
    )
    .digest('hex');
}

/** kb item type -> legal_sources.type (see docs/02-DATA-MODEL.md, legal_source_type). */
function sourceType(item: Item): string {
  switch (item.type) {
    case 'act-section':
      return 'statute';
    case 'regulation-section':
      return 'regulation';
    case 'schedule':
      return 'standard_bylaw';
    case 'crt-decision':
      return 'crt_decision';
    case 'court-decision':
      if (item.id.startsWith('bc.bcca.')) return 'bcca_decision';
      if (item.id.startsWith('bc.bcsc.')) return 'bcsc_decision';
      return 'court_decision';
    default:
      throw new Error(`no legal_sources type for kb type ${item.type}`);
  }
}

function parseArgs(argv: string[]): { apply: boolean; allowDraft: boolean } {
  const known = new Set(['--apply', '--allow-draft']);
  for (const a of argv) if (!known.has(a)) throw new Error(`unknown argument ${a}`);
  return { apply: argv.includes('--apply'), allowDraft: argv.includes('--allow-draft') };
}

function readDist(dir: string): { manifest: z.infer<typeof ManifestSchema>; items: Item[] } {
  const manifestPath = join(dir, 'manifest.json');
  const corpusPath = join(dir, 'corpus.jsonl');
  if (!existsSync(manifestPath) || !existsSync(corpusPath)) {
    throw new Error(`no kb build found in ${dir}. Run pnpm --dir kb build (or build:prod) first.`);
  }
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const items = readFileSync(corpusPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      const parsed = ItemSchema.safeParse(JSON.parse(l));
      if (!parsed.success) throw new Error(`corpus.jsonl line ${i + 1}: ${parsed.error.message}`);
      return parsed.data;
    });
  return { manifest, items };
}

/**
 * Embeds with the same model, input type and dimension the app uses for the building corpus, so a
 * legal chunk and a user's query land in the same space. Batched, because the whole corpus is a few
 * thousand chunks and the service limits request size.
 */
async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        input_type: 'document',
        truncation: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok)
      throw new Error(`embedding request failed: HTTP ${response.status}. Nothing further was written.`);
    const body = z
      .object({
        data: z.array(
          z.object({ index: z.number(), embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS) }),
        ),
      })
      .parse(await response.json());
    if (body.data.length !== batch.length)
      throw new Error('the embedding service returned an incomplete batch. Nothing further was written.');
    out.push(...body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    process.stdout.write(`\r  embedded ${out.length}/${texts.length} chunk(s)`);
  }
  if (texts.length) process.stdout.write('\n');
  return out;
}

async function apply(items: Item[], kbVersion: string): Promise<void> {
  const env = ApplyEnvSchema.parse(process.env);

  // Service-role client: admin CLI only. See the AGENTS.md section 0 note at the top of this file.
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: jurisdiction, error: jErr } = await db
    .from('jurisdictions')
    .select('id')
    .eq('code', 'BC')
    .maybeSingle();
  if (jErr) throw new Error(`could not read jurisdictions: ${jErr.message}`);
  if (!jurisdiction)
    throw new Error('no BC jurisdiction row. Seed public.jurisdictions before loading the corpus.');

  const { data: existingRows, error: eErr } = await db
    .from('legal_sources')
    .select('id,kb_id,content_sha256')
    .not('kb_id', 'is', null);
  if (eErr) throw new Error(`could not read legal_sources: ${eErr.message}`);
  const existing = new Map(
    z
      .array(z.object({ id: z.string(), kb_id: z.string(), content_sha256: z.string().nullable() }))
      .parse(existingRows ?? [])
      .map((r) => [r.kb_id, r]),
  );

  const hashes = new Map(items.map((i) => [i.id, contentHash(i)]));
  const changed = items.filter((i) => existing.get(i.id)?.content_sha256 !== hashes.get(i.id));
  const unchanged = items.length - changed.length;
  const orphans = [...existing.keys()].filter((kbId) => !items.some((i) => i.id === kbId));

  console.log(`${unchanged} source(s) unchanged, ${changed.length} to write.`);

  // Embed before writing anything, so a failure part way through never leaves a source row whose
  // chunks do not match its content hash.
  const embeddings = changed.length
    ? await embed(
        changed.flatMap((i) => i.chunks.map((c) => contextualText(i, c))),
        env.VOYAGE_API_KEY,
      )
    : [];

  let e = 0;
  let superseded = 0;
  for (const item of changed) {
    const { data: source, error: sErr } = await db
      .from('legal_sources')
      .upsert(
        {
          jurisdiction_id: jurisdiction.id,
          type: sourceType(item),
          title: item.title,
          citation: item.citation ?? item.id,
          url: item.source_url,
          in_force_from: item.in_force_from,
          in_force_to: item.in_force_to,
          verified_at: item.retrieved_at,
          kb_id: item.id,
          kb_version: kbVersion,
          supersedes_kb_id: item.supersedes,
          content_sha256: hashes.get(item.id) ?? null,
        },
        { onConflict: 'kb_id' },
      )
      .select('id')
      .single();
    if (sErr || !source)
      throw new Error(`upsert legal_sources for ${item.id} failed: ${sErr?.message ?? 'no row'}`);
    if (item.in_force_to) superseded++;

    // Replace the chunks wholesale: a section's text changed, so chunk boundaries may have moved and
    // matching old chunks to new ones would be guesswork.
    const { error: dErr } = await db.from('legal_chunks').delete().eq('source_id', source.id);
    if (dErr) throw new Error(`clearing legal_chunks for ${item.id} failed: ${dErr.message}`);
    const rows = item.chunks.map((c) => ({
      source_id: source.id,
      content: c.content,
      section_ref: c.section_ref,
      heading: c.heading,
      embedding: JSON.stringify(embeddings[e++]),
    }));
    if (rows.length) {
      const { error: cErr } = await db.from('legal_chunks').insert(rows);
      if (cErr) throw new Error(`insert legal_chunks for ${item.id} failed: ${cErr.message}`);
    }
  }

  const { error: syncErr } = await db
    .from('jurisdictions')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', jurisdiction.id);
  if (syncErr) throw new Error(`could not record the sync time: ${syncErr.message}`);

  console.log(`Loaded ${changed.length} source(s) from kb ${kbVersion}; ${unchanged} unchanged.`);
  if (superseded) {
    console.log(
      `${superseded} of them have in_force_to set, so they answer only "as of" questions before that date.`,
    );
  }
  if (orphans.length) {
    console.log(
      `\n${orphans.length} source(s) in the database are not in this build. Left untouched — an item leaving a build is not a repeal. Decide what each one means:`,
    );
    for (const kbId of orphans) console.log(`  ${kbId}`);
  }
}

async function main(): Promise<void> {
  const { apply: doApply, allowDraft } = parseArgs(process.argv.slice(2));
  const distDir = resolve(process.env.KB_DIST_DIR || 'kb/dist');
  if (!process.env.KB_DIST_DIR) console.warn('KB_DIST_DIR is not set; using kb/dist');
  const { manifest, items } = readDist(distDir);

  const law = items.filter((i) => i.layer === 'law');
  const skipped = items.filter((i) => i.layer !== 'law');

  console.log(`kb ${manifest.kb_version}, built ${manifest.built_at}, ${manifest.status_filter}`);
  console.log(`corpus ${manifest.corpus_sha256.slice(0, 12)} from ${distDir}\n`);
  console.log(
    `Would load ${law.length} law item(s) into legal_sources and ${law.reduce((n, i) => n + i.chunks.length, 0)} chunk(s) into legal_chunks:`,
  );
  for (const i of law) {
    console.log(
      `  ${i.id}  [${sourceType(i)}]  ${i.citation ?? ''}  ${i.chunks.length} chunk(s)  ${i.status}`,
    );
  }
  if (skipped.length) {
    console.log(`\nSkipping ${skipped.length} non-law item(s) (no target table yet):`);
    for (const i of skipped) console.log(`  ${i.id}  [${i.layer}/${i.type}]`);
  }

  if (!doApply) {
    console.log('\nDry run. Nothing was written. Pass --apply to load.');
    return;
  }
  if (!manifest.production) {
    if (!allowDraft) {
      throw new Error(
        'this build includes unapproved items. Use pnpm --dir kb build:prod, or pass --allow-draft for a non-production database.',
      );
    }
    if (process.env.DATABASE_ENVIRONMENT === 'production') {
      throw new Error('refusing to load unapproved kb items into a production database.');
    }
  }
  await apply(law, manifest.kb_version);
}

main().catch((err: unknown) => {
  console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
  process.exit(1);
});
