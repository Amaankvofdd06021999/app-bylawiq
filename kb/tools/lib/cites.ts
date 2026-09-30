// Cross-references in BC statute text: which sections a section's own words point at.
// Used by tools/link-cites.ts to fill `cites[]` on Act, regulation and Schedule items.
//
// The rule that matters: a reference resolves only when the text says which enactment it means.
// Inside the Strata Property Act a bare "section 135" is the Act; inside the Regulation it is the
// Regulation, and "of the Act" is the Act. Anything naming another enactment, a Part (the kb has no
// Part items), or an unqualified bylaw number (which may be a strata's own bylaw, not a standard
// one) is reported instead of cited. A wrong citation is worse than a missing one.

/**
 * The enactment a reference points at, or why it cannot be cited. `part` covers the structural
 * units (a Part or a Division): the kb holds one item per section, so there is nothing to cite.
 */
export type RefDoc = 'spa' | 'spr' | 'sched' | 'external' | 'part' | 'unqualified-bylaw';

/** The document an item belongs to: the Act, the Regulation, or the Schedule of Standard Bylaws. */
export type Scope = 'spa' | 'spr' | 'sched';

export type Reference = {
  /** The matched text, for reporting. */
  raw: string;
  doc: RefDoc;
  /** The other enactment's name when `doc` is `external`, otherwise null. */
  external: string | null;
  /** "Part" or "Division" when `doc` is `part`, otherwise null. */
  unit: string | null;
  /** Section (or standard bylaw) numbers named one by one. */
  numbers: string[];
  /** Inclusive ranges named with "to", expanded against the kb at resolve time. */
  ranges: { from: string; to: string }[];
};

export type Unresolved = {
  raw: string;
  reason: 'other-act' | 'part' | 'not-in-kb' | 'unqualified-bylaw';
  /** The id we would have cited, or the name of the other enactment. */
  target: string;
};

// ---------------------------------------------------------------------------
// Section numbering

/**
 * Orders section numbers the way BC Laws does: the whole number numerically, then inserted
 * decimals digit by digit, so 5.1 comes before 5.101, which comes before 5.11 and then 5.2.
 */
export function compareSectionNumbers(a: string, b: string): number {
  const [aWhole, aFraction = ''] = a.split('.', 2);
  const [bWhole, bFraction = ''] = b.split('.', 2);
  if (Number(aWhole) !== Number(bWhole)) return Number(aWhole) - Number(bWhole);
  return aFraction < bFraction ? -1 : aFraction > bFraction ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Finding references

/** "section", "sections", "bylaw", "bylaws", "Part" or "Division" immediately before a number. */
const LEAD = /(?<![A-Za-z])([Ss]ections?|[Bb]ylaws?|Parts?|Divisions?)\s+(?=\d)/g;
/** A section number with any subsection and paragraph parts: "149 (1) (d)", "34.1", "5.101". */
const NUMBER = /^(\d+(?:\.\d+)*)((?:\s*\([0-9A-Za-z.]+\))*)/;
/** Subsections on their own, as in "section 69 (1) (b) and (2) (b)": they continue the list, adding nothing. */
const BARE_SUBSECTION = /^\([0-9A-Za-z.]+\)(?:\s*\([0-9A-Za-z.]+\))*/;
/** What may join two members of a list, and whether it opens a range. */
const SEPARATOR = /^(?:\s*[,;]\s*(?:and\s+|or\s+)?|\s+(and|or|to)\s+)/;
/**
 * A list may repeat its own lead word: "section 12 (2) and (3) (a) and section 13 (2) (b) of the Act".
 * It must be the same kind of lead, so "Part 10 and section 324" stays two references.
 */
type LeadKind = 'section' | 'bylaw' | 'part' | 'division';

const REPEATED_LEAD: Record<LeadKind, RegExp> = {
  section: /^[Ss]ections?\s+(?=\d)/,
  bylaw: /^[Bb]ylaws?\s+(?=\d)/,
  part: /^Parts?\s+(?=\d)/,
  division: /^Divisions?\s+(?=\d)/,
};

function leadKind(lead: string): LeadKind {
  if (/^Part/.test(lead)) return 'part';
  if (/^Division/.test(lead)) return 'division';
  return /^[Bb]ylaw/.test(lead) ? 'bylaw' : 'section';
}
/** BC Laws puts an italicised marginal note between a reference and its enactment: "*[supporting documents]*". */
const MARGINAL_NOTE = /^(?:\s*\*\[[^\]]*\]\*)+/;

type Qualifier = { kind: 'act' | 'reg' | 'sched' | 'external'; name: string | null; length: number };

const QUALIFIERS: { re: RegExp; kind: Qualifier['kind'] }[] = [
  { re: /^\s*of\s+the\s+Act\b/, kind: 'act' },
  { re: /^\s*of\s+this\s+Act\b/, kind: 'act' },
  { re: /^\s*of\s+this\s+regulation\b/, kind: 'reg' },
  { re: /^\s*of\s+the\s+regulations?\b/, kind: 'reg' },
  { re: /^\s*of\s+the\s+Standard\s+Bylaws\b/, kind: 'sched' },
];
/** Another enactment, italicised as BC Laws writes it: "of the *Land Title Act*". */
const EXTERNAL_ITALIC = /^\s*of\s+the\s+\*([^*]+)\*/;
/** Another enactment named in plain text: "of the Electrical Safety Regulation". */
const EXTERNAL_PLAIN = /^\s*of\s+the\s+((?:[A-Z][\w’'-]*\s+)+(?:Act|Regulation|Code|Rules))\b/;

function readQualifier(rest: string): Qualifier | null {
  const note = MARGINAL_NOTE.exec(rest);
  const offset = note ? note[0].length : 0;
  const tail = rest.slice(offset);
  for (const { re, kind } of QUALIFIERS) {
    const m = re.exec(tail);
    if (m) return { kind, name: null, length: offset + m[0].length };
  }
  for (const re of [EXTERNAL_ITALIC, EXTERNAL_PLAIN]) {
    const m = re.exec(tail);
    if (m) return { kind: 'external', name: m[1].trim(), length: offset + m[0].length };
  }
  return null;
}

/** Drops Markdown heading lines: an item's own heading names the section it is, not one it cites. */
function withoutHeadings(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (/^#{1,6}\s/.test(line) ? '' : line))
    .join('\n');
}

type List = { numbers: string[]; ranges: { from: string; to: string }[]; end: number };

/** Reads "244 and 245", "224, 225 and 243", "112 to 118", "14 (4) and (5) and 17 (b)". */
function readList(text: string, start: number, kind: LeadKind): List | null {
  const first = NUMBER.exec(text.slice(start));
  if (!first) return null;
  const numbers = [first[1]];
  const ranges: { from: string; to: string }[] = [];
  let end = start + first[0].length;
  for (;;) {
    const sep = SEPARATOR.exec(text.slice(end));
    if (!sep) break;
    const lead = REPEATED_LEAD[kind].exec(text.slice(end + sep[0].length));
    const after = end + sep[0].length + (lead ? lead[0].length : 0);
    const next = NUMBER.exec(text.slice(after));
    if (next) {
      if (sep[1] === 'to' && numbers.length) {
        ranges.push({ from: numbers.pop() as string, to: next[1] });
      } else {
        numbers.push(next[1]);
      }
      end = after + next[0].length;
      continue;
    }
    const bare = BARE_SUBSECTION.exec(text.slice(after));
    if (bare) {
      end = after + bare[0].length;
      continue;
    }
    break; // Nothing follows the separator, so it was not a separator. Leave it unconsumed.
  }
  return { numbers, ranges, end };
}

/**
 * Every section of the Strata Property Regulation is numbered N.M (1.1, 6.4, 17.23), so an
 * unqualified whole number in a Regulation item cannot be a section of the Regulation: it is a
 * section of the Act, which the Regulation often names only in the stem above a list of paragraphs.
 * A list that mixes the two shapes is left with the Regulation, so the mismatch gets reported.
 */
function wholeNumbersOnly(list: Pick<List, 'numbers' | 'ranges'>): boolean {
  const named = [...list.numbers, ...list.ranges.flatMap((r) => [r.from, r.to])];
  return named.length > 0 && named.every((n) => !n.includes('.'));
}

function docFor(
  lead: string,
  qualifier: Qualifier | null,
  scope: Scope,
  list: Pick<List, 'numbers' | 'ranges'>,
): { doc: RefDoc; external: string | null; unit: string | null } {
  const kind = leadKind(lead);
  if (kind === 'part' || kind === 'division') {
    return { doc: 'part', external: null, unit: kind === 'part' ? 'Part' : 'Division' };
  }
  if (qualifier?.kind === 'external') return { doc: 'external', external: qualifier.name, unit: null };
  if (qualifier?.kind === 'act') return { doc: 'spa', external: null, unit: null };
  if (qualifier?.kind === 'reg') return { doc: 'spr', external: null, unit: null };
  if (qualifier?.kind === 'sched') return { doc: 'sched', external: null, unit: null };
  // Unqualified. A bylaw number outside the Schedule may be a strata's own bylaw: do not guess.
  if (kind === 'bylaw') {
    return { doc: scope === 'sched' ? 'sched' : 'unqualified-bylaw', external: null, unit: null };
  }
  if (scope === 'spr' && wholeNumbersOnly(list)) return { doc: 'spa', external: null, unit: null };
  return { doc: scope, external: null, unit: null };
}

/** Every cross-reference in one item's body, in the order the text makes them. */
export function findReferences(body: string, scope: Scope): Reference[] {
  const text = withoutHeadings(body);
  const refs: Reference[] = [];
  LEAD.lastIndex = 0;
  for (let m = LEAD.exec(text); m; m = LEAD.exec(text)) {
    const list = readList(text, m.index + m[0].length, leadKind(m[1]));
    if (!list) continue;
    const qualifier = readQualifier(text.slice(list.end));
    const { doc, external, unit } = docFor(m[1], qualifier, scope, list);
    refs.push({
      raw: text.slice(m.index, list.end + (qualifier?.length ?? 0)).replace(/\s+/g, ' ').trim(),
      doc,
      external,
      unit,
      numbers: list.numbers,
      ranges: list.ranges,
    });
    LEAD.lastIndex = list.end;
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Resolving references to kb ids

const ID_PREFIX: Record<'spa' | 'spr' | 'sched', string> = {
  spa: 'bc.spa.s',
  spr: 'bc.spr.s',
  sched: 'bc.spa.sched.bylaw',
};
const DOC_ORDER: ('spa' | 'spr' | 'sched')[] = ['spa', 'spr', 'sched'];

function sectionsOf(doc: 'spa' | 'spr' | 'sched', ids: Set<string>): string[] {
  const prefix = ID_PREFIX[doc];
  const out: string[] = [];
  for (const id of ids) {
    // bc.spa.s135 must not match the bc.spa.sched.bylaw* ids that share its prefix.
    if (!id.startsWith(prefix)) continue;
    const number = id.slice(prefix.length);
    if (/^\d+(?:\.\d+)*$/.test(number)) out.push(number);
  }
  return out;
}

/**
 * Turns references into a sorted, de-duplicated `cites[]` plus a list of what could not be cited.
 * `ids` is every id in the kb; a reference to a section the kb does not hold (repealed, or not
 * imported) is reported, never invented.
 */
export function resolveReferences(
  refs: Reference[],
  { ids, selfId }: { ids: Set<string>; selfId: string },
): { cites: string[]; unresolved: Unresolved[] } {
  const cites = new Set<string>();
  const unresolved: Unresolved[] = [];
  const seen = new Set<string>();
  const report = (u: Unresolved) => {
    const key = `${u.reason}|${u.target}|${u.raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    unresolved.push(u);
  };

  for (const ref of refs) {
    if (ref.doc === 'external') {
      report({ raw: ref.raw, reason: 'other-act', target: ref.external ?? 'unnamed enactment' });
      continue;
    }
    if (ref.doc === 'part') {
      const unit = ref.unit ?? 'Part';
      for (const n of ref.numbers) report({ raw: ref.raw, reason: 'part', target: `${unit} ${n}` });
      for (const r of ref.ranges) {
        report({ raw: ref.raw, reason: 'part', target: `${unit}s ${r.from} to ${r.to}` });
      }
      continue;
    }
    if (ref.doc === 'unqualified-bylaw') {
      report({ raw: ref.raw, reason: 'unqualified-bylaw', target: ref.raw });
      continue;
    }
    const prefix = ID_PREFIX[ref.doc];
    for (const n of ref.numbers) {
      const id = `${prefix}${n}`;
      if (id === selfId) continue;
      if (ids.has(id)) cites.add(id);
      else report({ raw: ref.raw, reason: 'not-in-kb', target: id });
    }
    for (const range of ref.ranges) {
      const inRange = sectionsOf(ref.doc, ids).filter(
        (n) => compareSectionNumbers(n, range.from) >= 0 && compareSectionNumbers(n, range.to) <= 0,
      );
      const usable = inRange.map((n) => `${prefix}${n}`).filter((id) => id !== selfId);
      if (usable.length === 0) {
        report({ raw: ref.raw, reason: 'not-in-kb', target: `${prefix}${range.from} to ${range.to}` });
        continue;
      }
      for (const id of usable) cites.add(id);
    }
  }

  return { cites: [...cites].sort(compareIds), unresolved };
}

function splitId(value: string): { doc: 'spa' | 'spr' | 'sched'; number: string } {
  if (value.startsWith(ID_PREFIX.sched)) return { doc: 'sched', number: value.slice(ID_PREFIX.sched.length) };
  if (value.startsWith(ID_PREFIX.spr)) return { doc: 'spr', number: value.slice(ID_PREFIX.spr.length) };
  return { doc: 'spa', number: value.slice(ID_PREFIX.spa.length) };
}

/** Act sections first, then Regulation sections, then standard bylaws, each in section order. */
function compareIds(a: string, b: string): number {
  const left = splitId(a);
  const right = splitId(b);
  if (left.doc !== right.doc) return DOC_ORDER.indexOf(left.doc) - DOC_ORDER.indexOf(right.doc);
  return compareSectionNumbers(left.number, right.number);
}

// ---------------------------------------------------------------------------
// Writing cites back

/**
 * Replaces the `cites` line inside an item's frontmatter and leaves every other byte alone, so a
 * later `pnpm import:bclaws` sees no difference. The flow style matches tools/import-bclaws.ts.
 */
export function replaceCitesLine(text: string, cites: string[]): string {
  const close = text.startsWith('---\n') ? text.indexOf('\n---', 3) : -1;
  if (close === -1) throw new Error('missing YAML frontmatter');
  const head = text.slice(0, close);
  if (!/^cites: .*$/m.test(head)) throw new Error('frontmatter has no cites field');
  return head.replace(/^cites: .*$/m, `cites: [${cites.join(', ')}]`) + text.slice(close);
}
