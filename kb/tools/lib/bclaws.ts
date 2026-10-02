// Converts BC Laws (CiviX) legislation XML into section records with Markdown bodies.
// Pure: no network or file access. tools/import-bclaws.ts does the fetching and writing.
//
// Rules, so the text stays exactly the published text:
// - Words, numbers and punctuation are copied as published. Whitespace runs (including
//   non-breaking spaces and line breaks inside a sentence) become one ordinary space.
// - Structure becomes Markdown: "# Section N — heading", "## (1)" per subsection, and nested
//   list items "- (a)", "  - (i)", "    - (A)", "      - (I)" for paragraphs, subparagraphs,
//   clauses and subclauses. Text that follows a list inside the same provision stays where
//   it is, as its own paragraph.
// - Inline styling follows the BC Laws page: defined terms **"term"**, Act names and
//   bracketed descriptions in italics.
// - Formulas published as tables of text become a fenced text block laid out like the page;
//   formulas published as images become an image link to BC Laws. Both are flagged.
// - Anything the converter does not recognise throws. A failed import is better than
//   silently wrong legal text.
import { child, elements, isElement, textContent, type XmlElement, type XmlNode } from './xml.ts';

export const BCLAWS_DOC_BASE = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/';

export type Heading = { num: string | null; title: string };

export type SectionRecord = {
  /** Section number exactly as published, for example "135", "34.1", "6.21". */
  num: string;
  /** The marginal note, which BC Laws shows as the section heading. */
  heading: string;
  /** Markdown body, starting with "# ..." . */
  body: string;
  /** The CiviX document id holding this section (for the section URL). */
  contentId: string;
  part: Heading | null;
  division: Heading | null;
  /** True for sections of a schedule (the Schedule of Standard Bylaws). */
  schedule: boolean;
  hasImageFormula: boolean;
  hasTextFormula: boolean;
};

export type OmittedSection = { num: string; heading: string; text: string; part: Heading | null; schedule: boolean };

export type ParsedDocument = {
  sections: SectionRecord[];
  /** Repealed and spent sections: skipped, recorded here with the published placeholder text. */
  omitted: OmittedSection[];
  /** Parts, in order, including parts with no current sections. */
  parts: Heading[];
  /** Schedules not converted (the Regulation's forms), by title. */
  skippedSchedules: string[];
};

export type ParseOptions = {
  /** CiviX document id used for sections outside any act:content wrapper (regulations). */
  defaultContentId: string;
  /** Convert bcl:schedule elements (true for the Act's Schedule of Standard Bylaws). */
  convertSchedules: boolean;
  /** Heading prefix for schedule sections, for example "Standard Bylaws, section". */
  scheduleSectionLabel: string;
};

const LIST_LEVELS = new Set(['bcl:paragraph', 'bcl:subparagraph', 'bcl:clause', 'bcl:subclause']);
const CONTAINERS = new Set(['act:act', 'act:content', 'reg:regulation', 'reg:content', 'bcl:part', 'bcl:division', 'bcl:schedule']);
const METADATA = new Set([
  'act:title', 'act:chapter', 'act:yearenacted', 'act:assentedto', 'act:currency',
  'reg:amend', 'reg:title', 'reg:acttitle', 'reg:regnum', 'reg:oic', 'reg:deposited', 'reg:effective',
  'reg:amsincluded', 'reg:regpitid', 'reg:provisionsnote',
]);

export const collapse = (s: string) => s.replace(/[\s ]+/g, ' ');

/** Escapes characters Markdown would treat as markup. BC Laws text rarely contains any. */
export function escapeText(s: string): string {
  return s.replace(/([\\`*_<])/g, '\\$1').replace(/\]\(/g, ']\\(');
}

function numOf(el: XmlElement): string {
  const n = child(el, 'bcl:num');
  return n ? collapse(textContent(n)).trim() : '';
}

function wrap(marker: string, inner: string): string {
  const lead = /^\s/.test(inner) ? ' ' : '';
  const trail = /\s$/.test(inner) ? ' ' : '';
  const core = inner.trim();
  return core ? `${lead}${marker}${core}${marker}${trail}` : `${lead}${trail}`;
}

/**
 * An element handler the caller supplies. It is tried before the built-in rules fail, so a
 * document kind with its own markup (the prescribed forms) can render it without loosening the
 * rules for the Act and the Regulation, where that markup appearing would mean a parse is wrong.
 * Returning undefined means "not mine", and the element is rejected as before.
 */
export type InlineExtra = (node: XmlElement, inner: () => string) => string | undefined;

/** Inline content of a text-bearing element, as one line of Markdown. */
export function inline(node: XmlNode, extra?: InlineExtra): string {
  return collapse(inlineRaw(node, extra)).trim();
}

/**
 * The same, but without trimming: for a node that is one fragment of a longer line rather than
 * the whole of it. Trimming a fragment deletes the space that separates it from the next one.
 */
export function inlineFragment(node: XmlNode, extra?: InlineExtra): string {
  return collapse(inlineRaw(node, extra));
}

function inlineRaw(node: XmlNode, extra?: InlineExtra): string {
  if (typeof node === 'string') return escapeText(collapse(node));
  const inner = () => node.children.map((c) => inlineRaw(c, extra)).join('');
  switch (node.name) {
    case 'bcl:text':
    case 'bcl:hnote':
    case 'bcl:link':
    case 'bcl:marginalnote':
      return inner();
    case 'in:term':
      return wrap('**', `"${collapse(inner()).trim()}"`);
    case 'in:doc':
    case 'in:desc':
    case 'in:em':
      return wrap('*', inner());
    case 'in:strong':
      return wrap('**', inner());
    case 'in:br':
      return ' ';
    default: {
      const custom = extra?.(node, inner);
      if (custom !== undefined) return custom;
      throw new Error(`unsupported inline element <${node.name}>`);
    }
  }
}

function paragraph(text: string): string {
  // A paragraph that starts like Markdown block syntax is escaped so it stays plain text.
  return /^(#|>|[-+*]\s|\d+[.)]\s)/.test(text) ? `\\${text}` : text;
}

type Flags = { image: boolean; textFormula: boolean };

function renderList(nodes: XmlElement[], depth: number, flags: Flags): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  for (const n of nodes) {
    const label = `(${numOf(n)})`;
    let started = false;
    let nested: XmlElement[] = [];
    const flushNested = () => {
      if (nested.length) lines.push(...renderList(nested, depth + 1, flags));
      nested = [];
    };
    for (const c of n.children) {
      if (typeof c === 'string') {
        if (c.trim()) throw new Error(`stray text in <${n.name}> ${label}: ${c.trim().slice(0, 60)}`);
        continue;
      }
      if (c.name === 'bcl:num') continue;
      if (c.name === 'bcl:text') {
        const t = inline(c);
        if (!t) continue;
        if (!started) {
          lines.push(`${indent}- ${label} ${t}`);
          started = true;
        } else {
          flushNested();
          lines.push('', `${indent}  ${t}`);
        }
      } else if (LIST_LEVELS.has(c.name)) {
        if (!started) {
          lines.push(`${indent}- ${label}`);
          started = true;
        }
        nested.push(c);
      } else if (c.name === 'oasis:table') {
        if (!started) {
          lines.push(`${indent}- ${label}`);
          started = true;
        }
        flushNested();
        lines.push('', ...renderTable(c, flags).split('\n').map((l) => `${indent}  ${l}`));
      } else {
        throw new Error(`unsupported element <${c.name}> inside <${n.name}> ${label}`);
      }
    }
    if (!started) lines.push(`${indent}- ${label}`);
    flushNested();
  }
  return lines;
}

/** Lays out a formula table as text, the way BC Laws displays it. */
export function renderTable(table: XmlElement, flags: Flags): string {
  const graphics: string[] = [];
  const findGraphics = (el: XmlElement) => {
    for (const c of elements(el)) {
      if (c.name === 'in:graphic') graphics.push(c.attrs.href ?? '');
      else findGraphics(c);
    }
  };
  findGraphics(table);
  if (graphics.length) {
    flags.image = true;
    return graphics
      .map((href) => {
        const m = /^\/document\/id\/statreg\/(.+)$/i.exec(href);
        if (!m) throw new Error(`unexpected graphic href ${href}`);
        return `![formula](${BCLAWS_DOC_BASE}${m[1]})`;
      })
      .join('\n\n');
  }

  flags.textFormula = true;
  const HR = '\u0000hr';
  const out: string[] = [];
  const rows: XmlElement[] = [];
  const findRows = (el: XmlElement) => {
    for (const c of elements(el)) {
      if (c.name === 'oasis:trow') rows.push(c);
      else if (['oasis:tgroup', 'oasis:tbody', 'oasis:thead'].includes(c.name)) findRows(c);
      else if (c.name !== 'oasis:colspec') throw new Error(`unsupported table element <${c.name}>`);
    }
  };
  findRows(table);
  for (const row of rows) {
    const cells = elements(row, 'oasis:entry').map((entry) => {
      const lines: string[] = [];
      let cur = '';
      const visit = (n: XmlNode) => {
        if (typeof n === 'string') cur += collapse(n);
        else if (n.name === 'in:br') {
          lines.push(cur);
          cur = '';
        } else if (n.name === 'in:hr') {
          lines.push(cur, HR);
          cur = '';
        } else if (n.name === 'oasis:line') n.children.forEach(visit);
        else cur += inlineRaw(n);
      };
      entry.children.forEach(visit);
      lines.push(cur);
      const trimmed = lines.map((l) => (l === HR ? l : collapse(l).trim()));
      // Drop empty lines around a fraction (they are layout, not text), keep a leading
      // empty line in a top-aligned cell (it pushes the text down to the fraction bar).
      while (trimmed.length > 1 && trimmed[trimmed.length - 1] === '') trimmed.pop();
      const hasHr = trimmed.includes(HR);
      if (hasHr) {
        while (trimmed[0] === '') trimmed.shift();
        const at = trimmed.indexOf(HR);
        const kept = trimmed.filter((l, i) => l !== '' || i === at);
        return { lines: kept, valign: entry.attrs.valign ?? 'top' };
      }
      return { lines: trimmed, valign: entry.attrs.valign ?? 'top' };
    });
    const anchor = Math.max(0, ...cells.map((c) => c.lines.indexOf(HR)));
    const placed = cells.map((c) => {
      const width = Math.max(1, ...c.lines.filter((l) => l !== HR).map((l) => [...l].length));
      const hr = c.lines.indexOf(HR);
      let offset = 0;
      let lines = c.lines;
      if (hr >= 0) offset = anchor - hr;
      else if (c.valign === 'center') {
        lines = lines.filter((l) => l !== '');
        offset = Math.max(0, anchor - Math.floor((lines.length - 1) / 2));
      }
      return { width, offset, lines };
    });
    const height = Math.max(...placed.map((p) => p.offset + p.lines.length));
    for (let r = 0; r < height; r++) {
      const parts = placed.map((p) => {
        const l = p.lines[r - p.offset];
        if (l === undefined) return ' '.repeat(p.width);
        if (l === HR) return '-'.repeat(p.width);
        const pad = p.width - [...l].length;
        const left = Math.floor(pad / 2);
        return ' '.repeat(left) + l + ' '.repeat(pad - left);
      });
      const line = parts.join('  ').trimEnd();
      if (line.trim()) out.push(line);
    }
  }
  if (out.some((l) => l.includes('```'))) throw new Error('formula text contains a code fence');
  // Table text is shown raw inside the fence, so undo inline escaping.
  return ['```text', ...out.map((l) => l.replace(/\\([\\`*_<(])/g, '$1')), '```'].join('\n');
}

function renderBlocks(el: XmlElement, flags: Flags): string[] {
  const blocks: string[] = [];
  let list: XmlElement[] = [];
  const flush = () => {
    if (list.length) blocks.push(renderList(list, 0, flags).join('\n'));
    list = [];
  };
  for (const c of el.children) {
    if (typeof c === 'string') {
      if (c.trim()) throw new Error(`stray text in <${el.name}>: ${c.trim().slice(0, 60)}`);
      continue;
    }
    switch (c.name) {
      case 'bcl:marginalnote':
      case 'bcl:num':
        break;
      case 'bcl:text':
      case 'bcl:hnote': {
        flush();
        const t = inline(c);
        if (t) blocks.push(paragraph(t));
        break;
      }
      case 'bcl:subsection': {
        if (el.name !== 'bcl:section') throw new Error('subsection outside a section');
        flush();
        blocks.push(`## (${numOf(c)})`);
        blocks.push(...renderBlocks(c, flags));
        break;
      }
      case 'bcl:definition':
        flush();
        blocks.push(...renderBlocks(c, flags));
        break;
      case 'oasis:table':
        flush();
        blocks.push(renderTable(c, flags));
        break;
      default:
        if (LIST_LEVELS.has(c.name)) list.push(c);
        else throw new Error(`unsupported element <${c.name}> inside <${el.name}>`);
    }
  }
  flush();
  return blocks;
}

export function isOmitted(num: string, heading: string): boolean {
  return heading === 'Repealed' || heading === 'Spent' || !/^\d+(\.\d+)?$/.test(num);
}

export function parseBclawsDocument(root: XmlElement, opts: ParseOptions): ParsedDocument {
  const doc: ParsedDocument = { sections: [], omitted: [], parts: [], skippedSchedules: [] };

  const walk = (el: XmlElement, ctx: { contentId: string; part: Heading | null; division: Heading | null; schedule: boolean }) => {
    for (const c of el.children) {
      if (!isElement(c)) {
        if (c.trim()) throw new Error(`stray text in <${el.name}>: ${c.trim().slice(0, 60)}`);
        continue;
      }
      if (METADATA.has(c.name)) continue;
      switch (c.name) {
        case 'act:content':
          walk(c, { ...ctx, contentId: c.attrs.id ?? ctx.contentId, division: null });
          break;
        case 'bcl:part': {
          const title = child(c, 'bcl:text');
          const part: Heading = { num: numOf(c) || null, title: title ? inline(title) : '' };
          doc.parts.push(part);
          walk(c, { ...ctx, part, division: null });
          break;
        }
        case 'bcl:division': {
          const title = child(c, 'bcl:text');
          walk(c, { ...ctx, division: { num: numOf(c) || null, title: title ? inline(title) : '' } });
          break;
        }
        case 'bcl:schedule': {
          const title = collapse(textContent(child(c, 'bcl:scheduletitle') ?? '')).trim();
          if (!opts.convertSchedules) {
            doc.skippedSchedules.push(title);
            break;
          }
          const schedulePart: Heading = { num: null, title };
          doc.parts.push(schedulePart);
          walk(c, { ...ctx, part: schedulePart, division: null, schedule: true });
          break;
        }
        case 'bcl:scheduletitle':
        case 'bcl:num':
          break;
        case 'bcl:text':
          if (el.name !== 'bcl:part' && el.name !== 'bcl:division') throw new Error(`unexpected text in <${el.name}>`);
          break;
        case 'bcl:centertext': {
          // In the Schedule of Standard Bylaws: "Division 1 — Duties of Owners, ...".
          const t = collapse(textContent(c)).trim();
          const m = /^Division\s+(\S+)\s+—\s+(.+)$/.exec(t);
          if (!m || !ctx.schedule) throw new Error(`unexpected centred text: ${t}`);
          ctx = { ...ctx, division: { num: m[1], title: m[2] } };
          break;
        }
        case 'bcl:section':
          handleSection(c, ctx);
          break;
        default:
          if (!CONTAINERS.has(c.name)) throw new Error(`unsupported element <${c.name}> in <${el.name}>`);
          walk(c, ctx);
      }
    }
  };

  const handleSection = (sec: XmlElement, ctx: { contentId: string; part: Heading | null; division: Heading | null; schedule: boolean }) => {
    const num = numOf(sec);
    const heading = inline(child(sec, 'bcl:marginalnote') ?? '');
    if (heading === '[No Sections]') return;
    if (isOmitted(num, heading)) {
      const text = elements(sec, 'bcl:text').map((t) => inline(t)).join(' ');
      doc.omitted.push({ num, heading, text, part: ctx.part, schedule: ctx.schedule });
      return;
    }
    if (!heading) throw new Error(`section ${num} has no heading`);
    const flags: Flags = { image: false, textFormula: false };
    const label = ctx.schedule ? opts.scheduleSectionLabel : 'Section';
    const blocks = [`# ${label} ${num} — ${heading}`, ...renderBlocks(sec, flags)];
    if (blocks.length < 2) throw new Error(`section ${num} has no text`);
    doc.sections.push({
      num,
      heading,
      body: blocks.join('\n\n') + '\n',
      contentId: ctx.contentId,
      part: ctx.part,
      division: ctx.division,
      schedule: ctx.schedule,
      hasImageFormula: flags.image,
      hasTextFormula: flags.textFormula,
    });
  };

  walk(root, { contentId: opts.defaultContentId, part: null, division: null, schedule: false });
  const seen = new Set<string>();
  for (const s of doc.sections) {
    const key = `${s.schedule ? 'sched' : 'body'}:${s.num}`;
    if (seen.has(key)) throw new Error(`section ${s.num} appears twice`);
    seen.add(key);
  }
  return doc;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Reads "current to September 22, 2026" from a BC Laws page and returns 2026-09-22. */
export function parseCurrentTo(html: string): string {
  const m = /current to\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/.exec(html);
  if (!m) throw new Error('could not find the "current to" date on the BC Laws page');
  const month = MONTHS.indexOf(m[1]);
  if (month < 0) throw new Error(`unknown month ${m[1]}`);
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
