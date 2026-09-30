// Usage:
//   pnpm import:bclaws              fetch the current consolidations from BC Laws, then write items
//   pnpm import:bclaws --offline    reuse the last fetch in kb/.cache/bclaws/ (no network)
//
// Imports the Strata Property Act (with the Schedule of Standard Bylaws) and the Strata Property
// Regulation from the official CiviX document endpoints, one Markdown item per section, and
// updates each folder's source.json. Licence: King's Printer Licence – British Columbia (verbatim
// allowed with attribution; see research/licensing-register.md).
//
// Politeness: requests are sequential, with a pause between them and an identifying User-Agent.
// Raw XML and HTML go to kb/.cache/ (git-ignored), never into the repository.
//
// Re-running is safe. Topics come from lib/bclaws-topics.ts. For a section whose text is
// unchanged, status, review sign-off, cites and supersedes are kept. For a section whose text
// changed, the item goes back to draft and its notes say so. Sections that disappear from
// BC Laws are reported and left in place for a person to retire (see the folder READMEs).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { KB_ROOT, loadTopicIds, parseItem } from './lib/kb.ts';
import { child, parseXml, textContent, type XmlElement } from './lib/xml.ts';
import { BCLAWS_DOC_BASE, parseBclawsDocument, parseCurrentTo, type Heading, type ParsedDocument, type SectionRecord } from './lib/bclaws.ts';
import { SPA_TOPICS, SPR_TOPICS, STANDARD_BYLAW_TOPICS } from './lib/bclaws-topics.ts';

const USER_AGENT = 'BylawIQ-kb-import/0.2 (+https://bylawiq.app; knowledge base refresh; sequential requests)';
const PAUSE_MS = 1500;
const CACHE_DIR = join(KB_ROOT, '.cache', 'bclaws');

type Source = {
  key: 'spa' | 'spr';
  /** CiviX document id of the whole consolidated text. */
  xmlDocId: string;
  /** CiviX document id of the page that states the "current to" date. */
  pageDocId: string;
  folder: string;
  type: 'act-section' | 'regulation-section';
  idPrefix: string;
  citation: string;
  /** Checks the document is the one we expect before anything is written. */
  check: (root: XmlElement) => void;
};

const SOURCES: Source[] = [
  {
    key: 'spa',
    xmlDocId: '98043_00_multi',
    pageDocId: '98043_00',
    folder: 'law/bc/acts/strata-property-act',
    type: 'act-section',
    idPrefix: 'bc.spa',
    citation: 'Strata Property Act, SBC 1998, c 43',
    check: (root) => {
      expectText(root, 'act:title', 'Strata Property Act');
      expectText(root, 'act:chapter', '43');
      expectText(root, 'act:yearenacted', '1998');
    },
  },
  {
    key: 'spr',
    xmlDocId: '43_2000',
    pageDocId: '43_2000',
    folder: 'law/bc/regulations/strata-property-regulation',
    type: 'regulation-section',
    idPrefix: 'bc.spr',
    citation: 'Strata Property Regulation, BC Reg 43/2000',
    check: (root) => {
      expectText(root, 'reg:title', 'Strata Property Regulation');
      expectText(root, 'reg:regnum', '43/2000');
    },
  },
];

function expectText(root: XmlElement, name: string, want: string) {
  const el = child(root, name);
  const got = el ? textContent(el).trim() : '(missing)';
  if (got !== want) throw new Error(`expected ${name} "${want}", got "${got}"`);
}

// ---------------------------------------------------------------------------
// Fetching

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function fetchText(url: string): Promise<string> {
  if (requests++ > 0) await sleep(PAUSE_MS);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/xml, text/html' } });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res.text();
}

type Fetched = { xml: string; page: string; fetchedAt: string };

async function load(src: Source, offline: boolean): Promise<Fetched> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const xmlPath = join(CACHE_DIR, `${src.xmlDocId}.xml`);
  const pagePath = join(CACHE_DIR, `${src.pageDocId}.html`);
  const metaPath = join(CACHE_DIR, `${src.key}.meta.json`);
  if (offline) {
    if (!existsSync(xmlPath) || !existsSync(pagePath) || !existsSync(metaPath)) {
      throw new Error(`--offline: no cached fetch for ${src.key} in ${relative(KB_ROOT, CACHE_DIR)}`);
    }
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { fetched_at: string };
    return { xml: readFileSync(xmlPath, 'utf8'), page: readFileSync(pagePath, 'utf8'), fetchedAt: meta.fetched_at };
  }
  const xmlUrl = `${BCLAWS_DOC_BASE}${src.xmlDocId}/xml`;
  const pageUrl = `${BCLAWS_DOC_BASE}${src.pageDocId}`;
  console.log(`fetching ${xmlUrl}`);
  const xml = await fetchText(xmlUrl);
  console.log(`fetching ${pageUrl}`);
  const page = await fetchText(pageUrl);
  const fetchedAt = new Date().toISOString();
  writeFileSync(xmlPath, xml);
  writeFileSync(pagePath, page);
  writeFileSync(metaPath, JSON.stringify({ xml_url: xmlUrl, page_url: pageUrl, fetched_at: fetchedAt }, null, 2) + '\n');
  return { xml, page, fetchedAt };
}

// ---------------------------------------------------------------------------
// Items

const q = (s: string) => JSON.stringify(s);
const pad2 = (n: string) => n.replace(/^(\d+)/, (d) => d.padStart(2, '0'));

function partFolder(part: Heading | null, schedule: boolean): string {
  if (schedule) return 'schedule-of-standard-bylaws';
  if (!part?.num) throw new Error('section outside a numbered Part');
  return `part-${pad2(part.num)}`;
}

function itemId(src: Source, s: SectionRecord): string {
  return s.schedule ? `${src.idPrefix}.sched.bylaw${s.num}` : `${src.idPrefix}.s${s.num}`;
}

function itemPath(src: Source, s: SectionRecord): string {
  const file = s.schedule ? `bylaw${s.num}.md` : `s${s.num}.md`;
  return `${src.folder}/${partFolder(s.part, s.schedule)}/${file}`;
}

function citationFor(src: Source, s: SectionRecord): string {
  return s.schedule ? `${src.citation}, Schedule of Standard Bylaws, s ${s.num}` : `${src.citation}, s ${s.num}`;
}

function sectionUrl(s: SectionRecord): string {
  return `${BCLAWS_DOC_BASE}${s.contentId}#section${s.num}`;
}

function topicsFor(src: Source, s: SectionRecord): string[] {
  const map = src.key === 'spr' ? SPR_TOPICS : s.schedule ? STANDARD_BYLAW_TOPICS : SPA_TOPICS;
  return map[s.num] ?? [];
}

type Existing = { status: string; reviewed_by: string | null; reviewed_at: string | null; cites: string[]; supersedes: string | null; body: string };

function readExisting(path: string): Existing | null {
  const full = join(KB_ROOT, path);
  if (!existsSync(full)) return null;
  const item = parseItem(readFileSync(full, 'utf8'), path);
  const fm = item.frontmatter;
  return {
    status: String(fm.status ?? 'draft'),
    reviewed_by: (fm.reviewed_by as string | null) ?? null,
    reviewed_at: (fm.reviewed_at as string | null) ?? null,
    cites: Array.isArray(fm.cites) ? (fm.cites as string[]) : [],
    supersedes: (fm.supersedes as string | null) ?? null,
    body: item.body,
  };
}

function notesFor(src: Source, s: SectionRecord, currentTo: string, changed: boolean): string {
  const parts = [
    `Imported verbatim by tools/import-bclaws.ts from the BC Laws consolidation current to ${currentTo}.`,
    'in_force_from is null because the consolidation does not state when this version of the section came into force; check the Tables of Legislative Changes before relying on a date.',
  ];
  if (s.hasImageFormula) parts.push('The formula is published as an image and is linked, not transcribed; check it on BC Laws.');
  if (s.hasTextFormula) parts.push('The formula is laid out as plain text from a table on BC Laws; check the layout against the source.');
  if (changed) parts.push('The text changed on the last import; re-review it against the source.');
  return parts.join(' ');
}

function render(fm: Array<[string, string]>, body: string): string {
  return `---\n${fm.map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}`;
}

type WriteResult = { created: number; changed: number; unchanged: number; paths: Set<string> };

function writeItems(src: Source, doc: ParsedDocument, currentTo: string, retrievedAt: string): WriteResult {
  const result: WriteResult = { created: 0, changed: 0, unchanged: 0, paths: new Set() };
  for (const s of doc.sections) {
    const path = itemPath(src, s);
    const existing = readExisting(path);
    const same = existing !== null && existing.body === s.body;
    const changed = existing !== null && !same;
    const keep = same ? existing : null;
    const topics = topicsFor(src, s);
    const fm: Array<[string, string]> = [
      ['id', itemId(src, s)],
      ['layer', 'law'],
      ['type', s.schedule ? 'schedule' : src.type],
      ['title', q(s.heading)],
      ['citation', q(citationFor(src, s))],
      ['jurisdiction', 'BC'],
      ['source_url', sectionUrl(s)],
      ['in_force_from', 'null'],
      ['in_force_to', 'null'],
      ['retrieved_at', retrievedAt],
      ['licence', 'bc-kings-printer'],
      ['topics', `[${topics.join(', ')}]`],
      ['cites', `[${(existing?.cites ?? []).join(', ')}]`],
      ['supersedes', existing?.supersedes ? existing.supersedes : 'null'],
      ['status', keep ? keep.status : 'draft'],
      ['reviewed_by', keep?.reviewed_by ? q(keep.reviewed_by) : 'null'],
      ['reviewed_at', keep?.reviewed_at ? keep.reviewed_at : 'null'],
      ['notes', q(notesFor(src, s, currentTo, changed))],
    ];
    const full = join(KB_ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, render(fm, s.body));
    result.paths.add(path);
    if (!existing) result.created++;
    else if (changed) result.changed++;
    else result.unchanged++;
  }
  return result;
}

function staleItems(src: Source, written: Set<string>): string[] {
  const out: string[] = [];
  const root = join(KB_ROOT, src.folder);
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      const rel = `${src.folder}/${name}/${f}`;
      if (f.endsWith('.md') && f !== 'README.md' && !written.has(rel)) out.push(rel);
    }
  }
  return out;
}

function checkTopics(src: Source, doc: ParsedDocument) {
  const known = loadTopicIds();
  const maps = src.key === 'spr' ? [{ map: SPR_TOPICS, schedule: false }] : [{ map: SPA_TOPICS, schedule: false }, { map: STANDARD_BYLAW_TOPICS, schedule: true }];
  for (const { map, schedule } of maps) {
    for (const [num, topics] of Object.entries(map)) {
      if (!doc.sections.some((s) => s.num === num && s.schedule === schedule)) {
        throw new Error(`lib/bclaws-topics.ts tags ${src.key} ${schedule ? 'standard bylaw' : 'section'} ${num}, which was not imported`);
      }
      for (const t of topics) if (!known.has(t)) throw new Error(`lib/bclaws-topics.ts uses unknown topic ${t}`);
    }
  }
}

// ---------------------------------------------------------------------------
// source.json

function updateSourceJson(src: Source, doc: ParsedDocument, currentTo: string, retrievedAt: string) {
  const path = join(KB_ROOT, src.folder, 'source.json');
  const prior = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const parts = doc.parts.map((p) => {
    const inPart = doc.sections.filter((s) => s.part === p);
    const divisions: { number: string | null; title: string; sections: string[] }[] = [];
    for (const s of inPart) {
      if (!s.division) continue;
      let d = divisions.find((x) => x.number === s.division?.num && x.title === s.division?.title);
      if (!d) divisions.push((d = { number: s.division.num, title: s.division.title, sections: [] }));
      d.sections.push(s.num);
    }
    const schedule = inPart.some((s) => s.schedule) || (p.num === null && p.title.startsWith('Schedule'));
    return {
      number: p.num,
      title: p.title,
      folder: inPart.length ? partFolder(p, schedule) : null,
      in_scope: inPart.length > 0,
      sections: inPart.map((s) => s.num),
      ...(divisions.length ? { divisions } : {}),
      ...(inPart.length ? {} : { note: 'No current sections in this Part.' }),
    };
  });
  const next = {
    title: prior.title,
    citation: prior.citation,
    chapter: prior.chapter,
    url: `${BCLAWS_DOC_BASE}${src.pageDocId}`,
    xml_url: `${BCLAWS_DOC_BASE}${src.xmlDocId}/xml`,
    consolidation_date: currentTo,
    licence: 'bc-kings-printer',
    retrieved_at: retrievedAt,
    parts,
    omitted: doc.omitted.map((o) => ({
      sections: o.num,
      where: o.schedule ? 'Schedule of Standard Bylaws' : o.part?.num ? `Part ${o.part.num}` : null,
      published_text: o.text.replace(/^\*(.*)\*$/, '$1'),
    })),
    ...(doc.skippedSchedules.length ? { not_imported: doc.skippedSchedules.map((t) => ({ schedule: t, reason: 'Prescribed forms: not imported yet (see README).' })) } : {}),
    notes: `Generated by tools/import-bclaws.ts. consolidation_date is the BC Laws "current to" date. Repealed and spent sections are not imported; they are listed in omitted[] with the text BC Laws publishes in their place.`,
  };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  for (const a of args) if (a !== '--offline') throw new Error(`unknown argument ${a}`);
  const offline = args.includes('--offline');

  const fetched = new Map<string, Fetched>();
  for (const src of SOURCES) fetched.set(src.key, await load(src, offline));

  for (const src of SOURCES) {
    const f = fetched.get(src.key)!;
    if (!/King's Printer/.test(f.page)) throw new Error(`${src.key}: the BC Laws page no longer shows the King's Printer copyright line; re-check the licence`);
    const root = parseXml(f.xml);
    src.check(root);
    const doc = parseBclawsDocument(root, {
      defaultContentId: src.xmlDocId,
      convertSchedules: src.key === 'spa',
      scheduleSectionLabel: 'Standard Bylaws, section',
    });
    checkTopics(src, doc);
    const currentTo = parseCurrentTo(f.page);
    const retrievedAt = f.fetchedAt.slice(0, 10);
    const res = writeItems(src, doc, currentTo, retrievedAt);
    updateSourceJson(src, doc, currentTo, retrievedAt);
    const stale = staleItems(src, res.paths);
    const sched = doc.sections.filter((s) => s.schedule).length;
    console.log(
      `${src.key}: ${doc.sections.length - sched} sections${sched ? ` and ${sched} standard bylaws` : ''} (current to ${currentTo}); ` +
        `${res.created} new, ${res.changed} changed, ${res.unchanged} unchanged; ${doc.omitted.length} repealed or spent group(s) skipped` +
        (doc.skippedSchedules.length ? `; ${doc.skippedSchedules.length} schedule(s) of forms not imported` : ''),
    );
    for (const p of stale) console.warn(`  no longer on BC Laws, retire by hand: ${p}`);
  }
}

main().catch((e: unknown) => {
  console.error(`import failed: ${(e as Error).message}`);
  process.exit(1);
});
