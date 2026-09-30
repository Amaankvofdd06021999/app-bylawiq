// Core loading and validation for the knowledge base.
// Self-contained: depends only on node built-ins and `yaml`. Never import from the app.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

/** kb/ root, resolved from this file (kb/tools/lib/kb.ts). */
export const KB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Folders that hold items. Everything else (research, tools, schema, taxonomy) is not content. */
export const CONTENT_DIRS = ['law', 'firm-starter', 'building-starter', 'topics', 'evals'] as const;

export const STATUS_ORDER = ['draft', 'reviewed', 'approved'] as const;
export type Status = (typeof STATUS_ORDER)[number];

export type Frontmatter = {
  id: string;
  layer: 'law' | 'firm' | 'building' | 'topic';
  type: string;
  title: string;
  citation: string | null;
  jurisdiction: string;
  source_url: string | null;
  in_force_from: string | null;
  in_force_to: string | null;
  retrieved_at: string | null;
  licence: string;
  topics: string[];
  cites: string[];
  supersedes: string | null;
  status: Status;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

export type RawItem = {
  /** Path relative to kb/, always with forward slashes. */
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

/** Sections of Acts, regulations and schedules: found by citation and text, so topics are optional. */
export const STATUTE_TYPES = new Set(['act-section', 'regulation-section', 'schedule']);

export type Issue = { level: 'error' | 'warning'; path: string; message: string };

type PropSchema = {
  type?: string | string[];
  enum?: string[];
  pattern?: string;
  minLength?: number;
  format?: string;
  uniqueItems?: boolean;
  items?: { type?: string };
};

export type Schema = {
  required: string[];
  properties: Record<string, PropSchema>;
  additionalProperties?: boolean;
  'x-layer-types': Record<string, string[]>;
  'x-layer-folders': Record<string, string[]>;
};

export type Context = {
  schema: Schema;
  topicIds: Set<string>;
  licenceIds: Set<string>;
};

const toPosix = (p: string) => p.split(sep).join('/');

// ---------------------------------------------------------------------------
// Loading

export function loadSchema(root = KB_ROOT): Schema {
  return JSON.parse(readFileSync(join(root, 'schema', 'frontmatter.schema.json'), 'utf8')) as Schema;
}

export function loadTopicIds(root = KB_ROOT): Set<string> {
  const raw = JSON.parse(readFileSync(join(root, 'taxonomy', 'topics.json'), 'utf8')) as {
    topics: { id: string }[];
  };
  return new Set(raw.topics.map((t) => t.id));
}

/**
 * Licence ids are the first column of the table in research/licensing-register.md,
 * written as `id` in backticks. Other rows (header, separator, prose) are ignored.
 */
export function parseLicenceIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const line of markdown.split('\n')) {
    const m = /^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/.exec(line);
    if (m) ids.add(m[1]);
  }
  return ids;
}

export function loadLicenceIds(root = KB_ROOT): Set<string> {
  return parseLicenceIds(readFileSync(join(root, 'research', 'licensing-register.md'), 'utf8'));
}

export function loadContext(root = KB_ROOT): Context {
  return { schema: loadSchema(root), topicIds: loadTopicIds(root), licenceIds: loadLicenceIds(root) };
}

function walk(dir: string, out: string[]): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every .md file under the content folders except README.md files. */
export function discoverItemFiles(root = KB_ROOT): string[] {
  return CONTENT_DIRS.flatMap((d) => walk(join(root, d), [])).filter(
    (f) => f.endsWith('.md') && !f.endsWith(`${sep}README.md`),
  );
}

export function parseItem(text: string, path: string): RawItem {
  const normalised = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalised);
  if (!m) throw new Error('missing YAML frontmatter (file must start with --- and close with ---)');
  const fm: unknown = parseYaml(m[1]);
  if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
    throw new Error('frontmatter must be a YAML mapping');
  }
  return { path, frontmatter: fm as Record<string, unknown>, body: m[2].trim() + '\n' };
}

export function loadItems(root = KB_ROOT): { items: RawItem[]; issues: Issue[] } {
  const items: RawItem[] = [];
  const issues: Issue[] = [];
  for (const file of discoverItemFiles(root)) {
    const path = toPosix(relative(root, file));
    try {
      items.push(parseItem(readFileSync(file, 'utf8'), path));
    } catch (e) {
      issues.push({ level: 'error', path, message: (e as Error).message });
    }
  }
  return { items, issues };
}

// ---------------------------------------------------------------------------
// Field-level checks (driven by the JSON Schema)

export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, mo, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function checkField(key: string, value: unknown, prop: PropSchema): string[] {
  const errs: string[] = [];
  const t = typeOf(value);
  if (prop.type) {
    const allowed = Array.isArray(prop.type) ? prop.type : [prop.type];
    if (!allowed.includes(t)) {
      errs.push(`${key} must be ${allowed.join(' or ')}, got ${t}`);
      return errs;
    }
  }
  if (prop.enum && !prop.enum.includes(value as string)) {
    errs.push(`${key} must be one of ${prop.enum.join(', ')}, got ${JSON.stringify(value)}`);
  }
  if (typeof value === 'string') {
    if (prop.pattern && !new RegExp(prop.pattern).test(value)) {
      errs.push(`${key} ${JSON.stringify(value)} does not match ${prop.pattern}`);
    }
    if (prop.minLength !== undefined && value.trim().length < prop.minLength) errs.push(`${key} must not be empty`);
    if (prop.format === 'date' && !isValidDate(value)) errs.push(`${key} ${JSON.stringify(value)} is not a valid YYYY-MM-DD date`);
    if (prop.format === 'uri' && !isHttpUrl(value)) errs.push(`${key} ${JSON.stringify(value)} is not an http(s) URL`);
  }
  if (Array.isArray(value)) {
    if (prop.items?.type && value.some((x) => typeOf(x) !== prop.items?.type)) {
      errs.push(`${key} must contain only ${prop.items.type} values`);
    }
    if (prop.uniqueItems && new Set(value).size !== value.length) errs.push(`${key} has duplicate entries`);
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Item validation

/** Validates parsed items against the schema and cross-item rules. Pure: no file access. */
export function validateItems(items: RawItem[], ctx: Context): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  const { schema } = ctx;

  // Pass 1: field checks and id collection.
  const byId = new Map<string, RawItem>();
  for (const item of items) {
    const fm = item.frontmatter;
    for (const key of schema.required) {
      if (!(key in fm)) err(item.path, `missing required field ${key}`);
    }
    for (const key of Object.keys(fm)) {
      const prop = schema.properties[key];
      if (!prop) {
        if (schema.additionalProperties === false) err(item.path, `unknown field ${key}`);
        continue;
      }
      for (const m of checkField(key, fm[key], prop)) err(item.path, m);
    }
    const id = fm.id;
    if (typeof id === 'string') {
      const prior = byId.get(id);
      if (prior) err(item.path, `duplicate id ${id} (also used by ${prior.path})`);
      else byId.set(id, item);
    }
  }

  // Pass 2: rules that need the whole set or more than one field.
  for (const item of items) {
    const fm = item.frontmatter as Partial<Frontmatter>;
    const { layer, type } = fm;

    if (layer && type) {
      const allowed = schema['x-layer-types'][layer];
      if (allowed && !allowed.includes(type)) err(item.path, `type ${type} is not allowed in layer ${layer} (allowed: ${allowed.join(', ')})`);
      const folders = schema['x-layer-folders'][layer] ?? [];
      const top = item.path.split('/')[0];
      if (!folders.includes(top)) err(item.path, `layer ${layer} items must live under ${folders.map((f) => f + '/').join(' or ')}`);
    }

    if (layer === 'law') {
      for (const key of ['source_url', 'retrieved_at', 'citation', 'in_force_from'] as const) {
        if (fm[key] === null || fm[key] === undefined || fm[key] === '') {
          // A consolidation does not say when each section's current text came into force.
          // Statute items may leave in_force_from null if notes say why.
          if (key === 'in_force_from' && STATUTE_TYPES.has(String(type)) && typeof fm.notes === 'string' && fm.notes.trim()) continue;
          err(item.path, `law items must have ${key}${key === 'in_force_from' && STATUTE_TYPES.has(String(type)) ? ' (or notes explaining why it is null)' : ''}`);
        }
      }
      if (fm.licence === undefined || fm.licence === null || fm.licence === '') err(item.path, 'law items must have a licence');
    }

    if (typeof fm.licence === 'string' && fm.licence !== '' && !ctx.licenceIds.has(fm.licence)) {
      err(item.path, `licence ${fm.licence} is not listed in research/licensing-register.md`);
    }

    if (Array.isArray(fm.topics)) {
      for (const t of fm.topics) {
        if (!ctx.topicIds.has(t)) err(item.path, `topic ${t} is not in taxonomy/topics.json`);
      }
      if (fm.topics.length === 0 && type !== 'checklist' && !STATUTE_TYPES.has(String(type))) warn(item.path, 'no topics set; the item will be hard to find');
    }

    if (Array.isArray(fm.cites)) {
      for (const c of fm.cites) {
        const target = byId.get(c);
        if (c === fm.id) err(item.path, 'an item cannot cite itself');
        else if (!target) err(item.path, `cites ${c}, which is not a kb item`);
        else if (fm.status === 'approved' && target.frontmatter.status !== 'approved') {
          warn(item.path, `approved item cites ${c}, which is ${String(target.frontmatter.status)}; the production build will not include it`);
        }
      }
    }

    if (typeof fm.supersedes === 'string') {
      if (fm.supersedes === fm.id) err(item.path, 'an item cannot supersede itself');
      else if (!byId.has(fm.supersedes)) err(item.path, `supersedes ${fm.supersedes}, which is not a kb item`);
    }

    if (typeof fm.in_force_from === 'string' && typeof fm.in_force_to === 'string'
      && isValidDate(fm.in_force_from) && isValidDate(fm.in_force_to) && fm.in_force_to < fm.in_force_from) {
      err(item.path, 'in_force_to is before in_force_from');
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const key of ['retrieved_at', 'reviewed_at'] as const) {
      const v = fm[key];
      if (typeof v === 'string' && isValidDate(v) && v > today) err(item.path, `${key} ${v} is in the future`);
    }

    if (fm.status === 'approved') {
      if (!fm.reviewed_by) err(item.path, 'status approved requires reviewed_by');
      if (!fm.reviewed_at) err(item.path, 'status approved requires reviewed_at');
    } else if (fm.status === 'reviewed' && (!fm.reviewed_by || !fm.reviewed_at)) {
      warn(item.path, 'status reviewed should record reviewed_by and reviewed_at');
    }

    if (item.body.trim().length === 0) warn(item.path, 'body is empty');

    if (type === 'crt-decision' || type === 'court-decision') {
      for (const m of checkDecision(item)) err(item.path, m);
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Decisions: our own summaries only (research/licensing-register.md)

/** Section headings every decision item must have, in this order. */
export const DECISION_HEADINGS = ['Facts', 'Issue', 'Holding', 'Principle'] as const;

/** Longest total block-quoted text a decision item may carry: a brief attributed quotation, never the judgment. */
export const MAX_DECISION_QUOTE_CHARS = 400;

/** A style of cause ("Smith v. The Owners, Strata Plan ...") names the parties. */
const STYLE_OF_CAUSE = /\sv\.?\s/i;

/**
 * Until the CRT and the BC courts grant written permission, a decision item is a citation, a link and
 * our own reviewed summary. These checks keep judgment text and CRT party names out of the kb. They
 * cannot prove a summary is in our own words; review does that.
 */
export function checkDecision(item: RawItem): string[] {
  const errs: string[] = [];
  const fm = item.frontmatter as Partial<Frontmatter>;
  const headings = [...item.body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => m[1].trim().toLowerCase());
  let from = 0;
  for (const h of DECISION_HEADINGS) {
    const at = headings.indexOf(h.toLowerCase(), from);
    if (at === -1) {
      errs.push(`decision items must have the headings ${DECISION_HEADINGS.join(', ')} in that order (missing or out of order: ${h})`);
      break;
    }
    from = at + 1;
  }
  const quoted = item.body
    .split('\n')
    .filter((l) => /^\s*>/.test(l))
    .reduce((n, l) => n + l.replace(/^\s*>\s?/, '').trim().length, 0);
  if (quoted > MAX_DECISION_QUOTE_CHARS) {
    errs.push(`decision items quote ${quoted} characters; the limit is ${MAX_DECISION_QUOTE_CHARS} (summarise in our own words, do not copy the decision)`);
  }
  if (fm.licence === 'bc-kings-printer') errs.push('decision items cannot use the bc-kings-printer licence');
  if (fm.type === 'crt-decision') {
    for (const key of ['title', 'citation'] as const) {
      const v = fm[key];
      if (typeof v === 'string' && STYLE_OF_CAUSE.test(v)) {
        errs.push(`crt-decision ${key} must not name the parties; use the neutral citation (for example 2024 BCCRT 123)`);
      }
    }
  }
  return errs;
}

// ---------------------------------------------------------------------------
// source.json for acts and regulations

export type SourceFile = {
  title: string;
  citation: string;
  chapter: string;
  url: string;
  consolidation_date: string | null;
  licence: string;
  retrieved_at: string | null;
  parts: unknown[];
};

export function validateSourceFile(raw: unknown, path: string, hasItems: boolean, ctx: Pick<Context, 'licenceIds'>): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: 'error', path, message });
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    err('source.json must be an object');
    return issues;
  }
  const s = raw as Partial<SourceFile>;
  for (const key of ['title', 'citation', 'chapter', 'url', 'licence'] as const) {
    if (typeof s[key] !== 'string' || s[key] === '') err(`${key} must be a non-empty string`);
  }
  if (typeof s.url === 'string' && !isHttpUrl(s.url)) err('url is not an http(s) URL');
  if (typeof s.licence === 'string' && s.licence && !ctx.licenceIds.has(s.licence)) {
    err(`licence ${s.licence} is not listed in research/licensing-register.md`);
  }
  for (const key of ['consolidation_date', 'retrieved_at'] as const) {
    const v = s[key];
    if (v !== null && v !== undefined && (typeof v !== 'string' || !isValidDate(v))) err(`${key} must be YYYY-MM-DD or null`);
    if (hasItems && (v === null || v === undefined)) err(`${key} is required once the folder contains items`);
  }
  if (!Array.isArray(s.parts)) err('parts must be an array');
  return issues;
}

/** Every folder directly under law/<jurisdiction>/{acts,regulations}/ needs a source.json. */
export function validateSources(root: string, ctx: Pick<Context, 'licenceIds'>): Issue[] {
  const issues: Issue[] = [];
  const lawDir = join(root, 'law');
  if (!existsSync(lawDir)) return issues;
  for (const juris of readdirSync(lawDir)) {
    for (const kind of ['acts', 'regulations']) {
      const kindDir = join(lawDir, juris, kind);
      if (!existsSync(kindDir) || !statSync(kindDir).isDirectory()) continue;
      for (const name of readdirSync(kindDir)) {
        const dir = join(kindDir, name);
        if (!statSync(dir).isDirectory()) continue;
        const rel = toPosix(relative(root, join(dir, 'source.json')));
        const hasItems = walk(dir, []).some((f) => f.endsWith('.md') && !f.endsWith(`${sep}README.md`));
        if (!existsSync(join(dir, 'source.json'))) {
          issues.push({ level: 'error', path: rel, message: 'missing source.json' });
          continue;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(readFileSync(join(dir, 'source.json'), 'utf8'));
        } catch (e) {
          issues.push({ level: 'error', path: rel, message: `invalid JSON: ${(e as Error).message}` });
          continue;
        }
        issues.push(...validateSourceFile(raw, rel, hasItems, ctx));
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Whole-kb entry point

export type LoadedKb = { items: RawItem[]; issues: Issue[]; ctx: Context };

export function loadAndValidate(root = KB_ROOT): LoadedKb {
  const ctx = loadContext(root);
  const issues: Issue[] = [];
  if (ctx.licenceIds.size === 0) {
    issues.push({ level: 'error', path: 'research/licensing-register.md', message: 'no licence ids found (expected rows starting with | `id` |)' });
  }
  const { items, issues: parseIssues } = loadItems(root);
  issues.push(...parseIssues, ...validateItems(items, ctx), ...validateSources(root, ctx));
  return { items, issues, ctx };
}

export function formatReport(issues: Issue[], itemCount: number): string {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const lines: string[] = [];
  const byPath = new Map<string, Issue[]>();
  for (const i of issues) byPath.set(i.path, [...(byPath.get(i.path) ?? []), i]);
  for (const [path, list] of [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(path);
    for (const i of list) lines.push(`  ${i.level === 'error' ? 'error  ' : 'warning'}  ${i.message}`);
  }
  if (lines.length) lines.push('');
  lines.push(`${itemCount} item(s) checked: ${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join('\n');
}

export function statusAtLeast(status: unknown, min: Status): boolean {
  return STATUS_ORDER.indexOf(status as Status) >= STATUS_ORDER.indexOf(min);
}
