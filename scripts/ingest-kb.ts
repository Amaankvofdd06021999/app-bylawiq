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
 */
import { readFileSync, existsSync } from 'node:fs';
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
  LEGAL_CORPUS_INGEST_ENABLED: z.literal('true', { message: 'LEGAL_CORPUS_INGEST_ENABLED must be "true" (written approval required)' }),
});

/** kb item type -> legal_sources.type (see docs/02-DATA-MODEL.md, legal_source_type). */
function sourceType(item: Item): string {
  switch (item.type) {
    case 'act-section': return 'statute';
    case 'regulation-section': return 'regulation';
    case 'schedule': return 'standard_bylaw';
    case 'crt-decision': return 'crt_decision';
    case 'court-decision':
      if (item.id.startsWith('bc.bcca.')) return 'bcca_decision';
      if (item.id.startsWith('bc.bcsc.')) return 'bcsc_decision';
      return 'court_decision';
    default: throw new Error(`no legal_sources type for kb type ${item.type}`);
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
 * TODO(embeddings): embed chunk content with the same model and dimension as legal_chunks.embedding
 * (see lib/ai/embeddings.ts and kb/research/open-questions.md, question 8), with a contextual header
 * per docs/04-AI-RAG-PIPELINE.md §3. Not wired yet, so --apply stops here before writing anything.
 */
async function embed(texts: string[]): Promise<number[][]> {
  void texts;
  throw new Error('embeddings are not wired yet (TODO(embeddings) in scripts/ingest-kb.ts). Nothing was written.');
}

async function apply(items: Item[], kbVersion: string): Promise<void> {
  const env = ApplyEnvSchema.parse(process.env);
  // Embed everything first so a failure never leaves a half-loaded corpus.
  const embeddings = await embed(items.flatMap((i) => i.chunks.map((c) => c.content)));

  // Service-role client: admin CLI only. See the AGENTS.md §0 note at the top of this file.
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: jurisdiction, error: jErr } = await db.from('jurisdictions').select('id').eq('code', 'BC').maybeSingle();
  if (jErr) throw new Error(`could not read jurisdictions: ${jErr.message}`);

  // TODO(ingest): legal_sources has no kb id column, so re-running inserts duplicates. Add a unique
  // kb_id column (kb/research/open-questions.md, question 6) and upsert on it before using --apply.
  // TODO(ingest): map kb_version to legal_sources.corpus_version (integer) once the scheme is agreed.
  let e = 0;
  for (const item of items) {
    const { data: source, error: sErr } = await db
      .from('legal_sources')
      .insert({
        jurisdiction_id: jurisdiction?.id ?? null,
        type: sourceType(item),
        title: item.title,
        citation: item.citation ?? item.id,
        url: item.source_url,
        in_force_from: item.in_force_from,
        in_force_to: item.in_force_to,
        verified_at: item.retrieved_at,
      })
      .select('id')
      .single();
    if (sErr || !source) throw new Error(`insert legal_sources for ${item.id} failed: ${sErr?.message ?? 'no row'}`);
    const rows = item.chunks.map((c) => ({
      source_id: source.id,
      content: c.content,
      section_ref: c.section_ref,
      heading: c.heading,
      embedding: JSON.stringify(embeddings[e++]),
    }));
    const { error: cErr } = await db.from('legal_chunks').insert(rows);
    if (cErr) throw new Error(`insert legal_chunks for ${item.id} failed: ${cErr.message}`);
  }
  console.log(`Loaded ${items.length} source(s) from kb ${kbVersion}.`);
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
  console.log(`Would load ${law.length} law item(s) into legal_sources and ${law.reduce((n, i) => n + i.chunks.length, 0)} chunk(s) into legal_chunks:`);
  for (const i of law) {
    console.log(`  ${i.id}  [${sourceType(i)}]  ${i.citation ?? ''}  ${i.chunks.length} chunk(s)  ${i.status}`);
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
      throw new Error('this build includes unapproved items. Use pnpm --dir kb build:prod, or pass --allow-draft for a non-production database.');
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
