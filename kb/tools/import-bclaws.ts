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
// changed, the previous text is kept: it is written to superseded/<section>.<date>.md with
// in_force_to set and its review sign-off intact, the new item points at it through `supersedes` and
// goes back to draft, and the report prints what moved (see lib/supersede.ts). Sections that
// disappear from BC Laws are reported and left in place for a person to retire (see the READMEs).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { KB_ROOT, loadTopicIds, parseItem } from './lib/kb.ts';
import { child, parseXml, textContent, type XmlElement } from './lib/xml.ts';
import { parseForms, parseFormReference, type FormRecord } from './lib/forms.ts';
import { BCLAWS_DOC_BASE, parseBclawsDocument, parseCurrentTo, type Heading, type ParsedDocument, type SectionRecord } from './lib/bclaws.ts';
import { SPA_TOPICS, SPR_TOPICS, STANDARD_BYLAW_TOPICS, FORM_TOPICS } from './lib/bclaws-topics.ts';
import { archiveItem, changedLines, supersededId, supersededPath } from './lib/supersede.ts';

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

type Superseded = { id: string; archivePath: string; itemPath: string; diff: string[] };
type WriteResult = { created: number; changed: number; unchanged: number; paths: Set<string>; superseded: Superseded[] };

type Prior = { existing: Existing | null; keep: Existing | null; changed: boolean; supersedes: string | null };

/**
 * Looks at what is already on disk for an item and, when the text has changed, keeps the previous
 * version before it is overwritten. Without this the old text is lost and a question about an
 * earlier date cannot be answered. Shared by sections and by the prescribed forms.
 */
function supersedePrior(src: Source, id: string, path: string, body: string, currentTo: string, result: WriteResult): Prior {
  const existing = readExisting(path);
  const same = existing !== null && existing.body === body;
  const changed = existing !== null && !same;
  let supersedes: string | null = existing?.supersedes ?? null;
  if (changed) {
    const priorText = readFileSync(join(KB_ROOT, path), 'utf8');
    const archiveId = supersededId(id, currentTo);
    const archivePath = supersededPath(src.folder, path, currentTo);
    const archiveFull = join(KB_ROOT, archivePath);
    mkdirSync(dirname(archiveFull), { recursive: true });
    writeFileSync(archiveFull, archiveItem(priorText, { id: archiveId, inForceTo: currentTo }));
    supersedes = archiveId;
    result.superseded.push({ id: archiveId, archivePath, itemPath: path, diff: changedLines(existing.body, body) });
  }
  return { existing, keep: same ? existing : null, changed, supersedes };
}

function commit(path: string, fm: Array<[string, string]>, body: string, prior: Prior, result: WriteResult) {
  const full = join(KB_ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, render(fm, body));
  result.paths.add(path);
  if (!prior.existing) result.created++;
  else if (prior.changed) result.changed++;
  else result.unchanged++;
}

function writeItems(src: Source, doc: ParsedDocument, currentTo: string, retrievedAt: string): WriteResult {
  const result: WriteResult = { created: 0, changed: 0, unchanged: 0, paths: new Set(), superseded: [] };
  for (const s of doc.sections) {
    const path = itemPath(src, s);
    const prior = supersedePrior(src, itemId(src, s), path, s.body, currentTo, result);
    const { existing, keep, changed, supersedes } = prior;
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
      ['supersedes', supersedes ?? 'null'],
      ['status', keep ? keep.status : 'draft'],
      ['reviewed_by', keep?.reviewed_by ? q(keep.reviewed_by) : 'null'],
      ['reviewed_at', keep?.reviewed_at ? keep.reviewed_at : 'null'],
      ['notes', q(notesFor(src, s, currentTo, changed))],
    ];
    commit(path, fm, s.body, prior, result);
  }
  return result;
}

/** "B" -> "b", "Z.1" -> "z.1": the form letter as it appears in an item id. */
function formKey(num: string): string {
  return num.toLowerCase();
}

function formTitle(f: FormRecord): string {
  return f.title ? `Form ${f.num} \u2014 ${f.title}` : `Form ${f.num}`;
}

function formNotes(f: FormRecord, currentTo: string, changed: boolean): string {
  const parts = [
    `Imported verbatim by tools/import-bclaws.ts from the Schedule of Forms of the BC Laws consolidation current to ${currentTo}.`,
    'Every word of the form is kept, in published order. The layout is simplified: a table is written as one line per row with cells separated by " | ", a tick box as "[ ]", and a rule dividing one part of the form from the next as "---". Use it to answer what the form asks for and in what words, not to reproduce the form. File the version published by the Land Title and Survey Authority or BC Laws, not this text.',
  ];
  if (f.repealed) {
    parts.push('This form has been repealed and is kept because it still occupies its letter in the Schedule. Do not use it. in_force_to is null because the consolidation does not state the date the repeal took effect; check the Tables of Legislative Changes.');
  } else {
    parts.push('in_force_from is null because the consolidation does not state when this version of the form came into force; check the Tables of Legislative Changes before relying on a date.');
  }
  if (f.history) parts.push(`Amendment history as published: ${f.history}`);
  if (changed) parts.push('The text changed on the last import; re-review it against the source.');
  return parts.join(' ');
}

/** The ids of the sections a form's printed reference names, in published order. */
function formCites(f: FormRecord): string[] {
  const { act, reg } = parseFormReference(f.reference);
  return [...act.map((n) => `bc.spa.s${n}`), ...reg.map((n) => `bc.spr.s${n}`)];
}

/**
 * The prescribed forms, written as items of their own. They are not sections, so they do not go
 * through writeItems: a form has a letter rather than a number and a name rather than a marginal
 * note, and its citation names the Schedule of Forms.
 */
function writeForms(src: Source, forms: FormRecord[], currentTo: string, retrievedAt: string): WriteResult {
  const result: WriteResult = { created: 0, changed: 0, unchanged: 0, paths: new Set(), superseded: [] };
  for (const f of forms) {
    const id = `${src.idPrefix}.form.${formKey(f.num)}`;
    const path = `${src.folder}/forms/form-${formKey(f.num).replace('.', '-')}.md`;
    const body = `# ${formTitle(f)}\n\n${f.body}`;
    const prior = supersedePrior(src, id, path, body, currentTo, result);
    const { keep, changed, supersedes } = prior;
    const citation = `${src.citation}, Schedule of Forms, Form ${f.num}`;
    const fm: Array<[string, string]> = [
      ['id', id],
      ['layer', 'law'],
      ['type', 'schedule'],
      ['title', q(formTitle(f))],
      ['citation', q(citation)],
      ['jurisdiction', 'BC'],
      ['source_url', `${BCLAWS_DOC_BASE}${src.xmlDocId}`],
      ['in_force_from', 'null'],
      ['in_force_to', 'null'],
      ['retrieved_at', retrievedAt],
      ['licence', 'bc-kings-printer'],
      ['topics', `[${(FORM_TOPICS[f.num] ?? []).join(', ')}]`],
      // Unlike a section's cites, these are not left to pnpm link:cites. They come from the
      // reference BC Laws prints under the form's name, which says plainly which sections are
      // the Act's and which the Regulation's — something the prose scanner cannot tell from a
      // bare "Section 59" sitting inside a Regulation item.
      ['cites', `[${formCites(f).join(', ')}]`],
      ['supersedes', supersedes ?? 'null'],
      ['status', keep ? keep.status : 'draft'],
      ['reviewed_by', keep?.reviewed_by ? q(keep.reviewed_by) : 'null'],
      ['reviewed_at', keep?.reviewed_at ? keep.reviewed_at : 'null'],
      ['notes', q(formNotes(f, currentTo, changed))],
    ];
    commit(path, fm, body, prior, result);
  }
  return result;
}

function staleItems(src: Source, written: Set<string>): string[] {
  const out: string[] = [];
  const root = join(KB_ROOT, src.folder);
  for (const name of readdirSync(root)) {
    // superseded/ holds previous versions on purpose; they are not current sections and never stale.
    if (name === 'superseded') continue;
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

/** Every letter tagged in FORM_TOPICS must be a form that was actually imported. */
function checkFormTopics(src: Source, forms: FormRecord[]) {
  if (src.key !== 'spr') return;
  const known = loadTopicIds();
  for (const [letter, topics] of Object.entries(FORM_TOPICS)) {
    if (!forms.some((f) => f.num === letter)) {
      throw new Error(`lib/bclaws-topics.ts tags Form ${letter}, which was not imported`);
    }
    for (const t of topics) if (!known.has(t)) throw new Error(`lib/bclaws-topics.ts uses unknown topic ${t}`);
  }
}

function updateSourceJson(src: Source, doc: ParsedDocument, forms: FormRecord[], currentTo: string, retrievedAt: string) {
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
    ...(forms.length
      ? {
          forms: forms.map((f) => ({
            form: f.num,
            title: f.title,
            reference: f.reference,
            repealed: f.repealed,
            id: `${src.idPrefix}.form.${formKey(f.num)}`,
          })),
        }
      : {}),
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
    // The Regulation's Schedule of Forms. The section parser leaves it alone because a form is a
    // document rather than a provision; it is parsed and written separately here.
    const forms = src.key === 'spr' ? parseForms(root) : [];
    if (forms.length) {
      const fres = writeForms(src, forms, currentTo, retrievedAt);
      res.created += fres.created;
      res.changed += fres.changed;
      res.unchanged += fres.unchanged;
      for (const path of fres.paths) res.paths.add(path);
      res.superseded.push(...fres.superseded);
    }
    checkFormTopics(src, forms);
    updateSourceJson(src, doc, forms, currentTo, retrievedAt);
    const stale = staleItems(src, res.paths);
    const sched = doc.sections.filter((s) => s.schedule).length;
    console.log(
      `${src.key}: ${doc.sections.length - sched} sections${sched ? ` and ${sched} standard bylaws` : ''}` +
        (forms.length ? ` and ${forms.length} prescribed forms (${forms.filter((f) => f.repealed).length} repealed)` : '') +
        ` (current to ${currentTo}); ` +
        `${res.created} new, ${res.changed} changed, ${res.unchanged} unchanged; ${doc.omitted.length} repealed or spent group(s) skipped`,
    );
    for (const p of stale) console.warn(`  no longer on BC Laws, retire by hand: ${p}`);
    for (const s of res.superseded) {
      console.log(`\n  ${s.itemPath} changed. Previous text kept as ${s.id} (${s.archivePath}).`);
      for (const line of s.diff) console.log(`    ${line}`);
    }
    if (res.superseded.length) {
      console.log(
        `\n  ${res.superseded.length} section(s) superseded. Each archived item has in_force_to = ${currentTo}, which is ` +
          `the date the change was found, not the date the amendment came into force. Correct those from the Tables of ` +
          `Legislative Changes (task A2), re-review the changed sections, and run pnpm link:cites.`,
      );
    }
  }
}

main().catch((e: unknown) => {
  console.error(`import failed: ${(e as Error).message}`);
  process.exit(1);
});
