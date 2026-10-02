// The prescribed forms in the Schedule of Forms of the Strata Property Regulation (Forms A to Z.1).
//
// Why these are parsed separately from sections: a form is a document, not a provision. It has a
// letter rather than a section number, a name rather than a marginal note, and its content is
// free-form text and tables with dotted blanks to fill in. The section parser in bclaws.ts is strict
// about provision structure and its table renderer is built for the Regulation's formulas
// (fractions, rules, vertical alignment), which would mangle a form's layout.
//
// What this keeps and what it does not: every word, in document order, exactly as published.
// Layout is simplified — a table becomes one line per row with cells separated by " | ", and the
// dotted blanks stay as they are. So a form item answers "what does Form B ask for, and in what
// words", not "what does Form B look like on the page". Each item's notes say so. The licence
// covers this: the King's Printer Licence extends to the prescribed form content in the Regulation;
// what it excludes is the government's own fillable form products (cl. 8.1(a), open question 15).
import { collapse, inlineFragment, type InlineExtra } from './bclaws.ts';
import { child, elements, textContent, type XmlElement, type XmlNode } from './xml.ts';

export type FormRecord = {
  /** The form letter as published: "B", "Z.1". */
  num: string;
  /** The form's name in sentence case, without the section reference: "Information Certificate". */
  title: string | null;
  /**
   * The section reference printed under the form's name, verbatim and whole: "Section 59",
   * "Sections 245 (a), 246, 264", "Section 224; Regulation section 14.5 (1)". It is kept whole
   * rather than reduced to one number because a form can be prescribed for many sections at
   * once — Form E cites fourteen, across both the Act and the Regulation.
   */
  reference: string | null;
  /** The amendment history printed above the form's name, if any. */
  history: string | null;
  /** True when the form has been repealed but still occupies its letter in the Schedule. */
  repealed: boolean;
  /** The form, as Markdown. */
  body: string;
};

const FORM_TITLE = /^Form\s+([A-Z](?:\.\d+)?)\b/;
// The reference is a parenthesised line of its own under the name. Requiring the word "section"
// keeps Form A's "(OPTIONAL FORM)", which is printed in the same position, from being read as one.
const SECTION_REF = /^\((.*\bsections?\b.*)\)$/is;
// "[am. B.C. Reg. ...]", "[en. B.C. Reg. ...]", and for a repealed form the bare
// "[B.C. Reg. 6/2023, s. 7.]" that follows "Repealed." — all printed as a centred line.
const HISTORY = /\[[^\]]*\bB\.C\.\s*Regs?\.[^\]]*\]/is;
const REPEALED = /^Repealed\./i;

/** "NOTICE OF TENANT'S RESPONSIBILITIES" -> "Notice of Tenant's Responsibilities". */
function sentenceCase(s: string): string {
  const small = new Set(['of', 'to', 'the', 'and', 'or', 'for', 'in', 'on', 'a', 'an', 'by']);
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Separates any table nested inside a cell from the cell's own text. The published forms lay a
 * real table (the unit entitlement schedules in Forms V to Y) inside a single cell of a wrapper
 * table. Rendering it as cell text would run every row together on one line, so its rows are
 * pulled out and emitted as rows in their own right.
 */
function splitNested(nodes: XmlNode[]): { kept: XmlNode[]; nested: XmlElement[] } {
  const kept: XmlNode[] = [];
  const nested: XmlElement[] = [];
  for (const n of nodes) {
    if (typeof n === 'string' || n.name !== 'oasis:table') {
      if (typeof n !== 'string') {
        const inner = splitNested(n.children);
        nested.push(...inner.nested);
        kept.push(inner.nested.length ? { ...n, children: inner.kept } : n);
        continue;
      }
      kept.push(n);
      continue;
    }
    nested.push(n);
  }
  return { kept, nested };
}

function renderTable(table: XmlElement): string[] {
  const rows: XmlElement[] = [];
  const find = (el: XmlElement) => {
    for (const c of elements(el)) {
      if (c.name === 'oasis:trow') rows.push(c);
      else if (['oasis:tgroup', 'oasis:tbody', 'oasis:thead'].includes(c.name)) find(c);
      else if (c.name !== 'oasis:colspec') throw new Error(`unsupported table element <${c.name}>`);
    }
  };
  find(table);
  const out: string[] = [];
  for (const row of rows) {
    const after: string[] = [];
    const cells = elements(row, 'oasis:entry')
      .map((entry) => {
        const { kept, nested } = splitNested(entry.children);
        for (const t of nested) after.push(...renderTable(t));
        return collapse(kept.map(renderNode).join('')).trim();
      })
      // A blank cell is layout, not content, so it does not earn a separator.
      .filter((c) => c !== '');
    if (cells.length) out.push(cells.join(' | '));
    out.push(...after);
  }
  return out;
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
};

/**
 * The markup that only the forms use. It is kept out of the shared inline renderer on purpose:
 * if one of these turned up in a section of the Act, that would mean the parse had gone wrong.
 */
const formInline: InlineExtra = (node, inner) => {
  switch (node.name) {
    // Every rule in the Schedule of Forms today divides one block from the next, and
    // renderBlocks handles those before reaching here. A bar inside a line is the other thing
    // the element is used for in this Regulation — the bar of a fraction, as in the unit
    // entitlement formulas in section 6.4 — so it is written as a division rather than
    // stopping the import over an element whose meaning here is not in doubt.
    case 'in:hr':
      return ' / ';
    case 'in:sup': {
      const text = collapse(inner()).trim();
      return [...text].every((ch) => ch in SUPERSCRIPT)
        ? [...text].map((ch) => SUPERSCRIPT[ch]).join('')
        : `^${text}`;
    }
    case 'in:graphic': {
      // The only image in the forms is the 12px tick-box. It is a box to tick, so it is written
      // as one: the image carries no words and linking it would put a remote asset in the corpus.
      // Any other graphic stops the import — a diagram or a Provincial symbol must not pass
      // silently, and the licence does not cover the coat of arms or government logos (cl. 4.1).
      const href = node.attrs.href ?? '';
      if (/checkbox\d*\.gif$/i.test(href)) return '[ ]';
      throw new Error(`unsupported graphic in a form: ${href}`);
    }
    default:
      return undefined;
  }
};

function renderNode(node: XmlNode): string {
  if (typeof node === 'string') return collapse(node);
  if (node.name === 'oasis:line') return node.children.map(renderNode).join('') + ' ';
  // A fragment, not a whole line: the block and cell renderers collapse and trim the result.
  return inlineFragment(node, formInline);
}

/** True when a block holds nothing but a rule, so the rule divides blocks rather than a fraction. */
function isRule(el: XmlElement): boolean {
  const kids = el.children.filter((c) => typeof c !== 'string' || c.trim() !== '');
  return kids.length === 1 && typeof kids[0] !== 'string' && kids[0].name === 'in:hr';
}

/** The block elements a form is built from. Anything else stops the import rather than vanishing. */
function renderBlocks(el: XmlElement): string[] {
  const lines: string[] = [];
  for (const c of elements(el)) {
    switch (c.name) {
      case 'bcl:scheduletitle':
      case 'bcl:schedulesubtitle':
        break; // Carried in the frontmatter and the heading instead.
      case 'bcl:lefttext':
      case 'bcl:centertext':
      case 'bcl:indent1':
      case 'bcl:indent2':
      case 'bcl:indent3': {
        // A rule on a line of its own divides one part of a form from the next: Form E holds
        // five certificates and Form V four schedules, only one of which is ever filed.
        if (isRule(c)) {
          lines.push('---');
          break;
        }
        const t = collapse(c.children.map(renderNode).join('')).trim();
        if (t) lines.push(t);
        break;
      }
      case 'oasis:table':
        lines.push(...renderTable(c));
        break;
      default:
        throw new Error(`unsupported element in a form: <${c.name}>`);
    }
  }
  return lines;
}

/** Every Form schedule in the document, in order. Other schedules are left alone. */
export function parseForms(root: XmlElement): FormRecord[] {
  const forms: FormRecord[] = [];
  const walk = (el: XmlElement) => {
    for (const c of elements(el)) {
      if (c.name !== 'bcl:schedule') {
        walk(c);
        continue;
      }
      const titleEl = child(c, 'bcl:scheduletitle');
      const raw = titleEl ? collapse(textContent(titleEl)).trim() : '';
      const m = FORM_TITLE.exec(raw);
      if (!m) continue; // Not a form: the Act's Schedule of Standard Bylaws comes through here.
      const subtitleEl = child(c, 'bcl:schedulesubtitle');
      const name = subtitleEl ? collapse(textContent(subtitleEl)).trim() : '';

      // The reference, the amendment history and a repeal note are all printed as centred lines
      // around the name. Only the lines before the body proper are considered, so a parenthesis
      // inside the form's own text cannot be mistaken for the form's section reference.
      let reference: string | null = null;
      let history: string | null = null;
      let repealed = false;
      for (const line of elements(c)) {
        if (line.name === 'bcl:lefttext' || line.name === 'oasis:table') break;
        if (line.name !== 'bcl:centertext') continue;
        const text = collapse(textContent(line)).trim();
        const ref = SECTION_REF.exec(text);
        if (ref && !reference) reference = ref[1].trim();
        const hist = HISTORY.exec(text);
        if (hist && !history) history = hist[0].replace(/^\[|\]$/g, '').trim();
        if (REPEALED.test(text)) repealed = true;
      }

      forms.push({
        num: m[1],
        title: name ? sentenceCase(name) : null,
        reference,
        history,
        repealed,
        body: renderBlocks(c).join('\n\n') + '\n',
      });
    }
  };
  walk(root);
  return forms;
}

/**
 * The sections a form's printed reference names, split by which enactment they belong to.
 *
 * The Schedule of Forms is part of the Regulation, but a bare "Section 59" in it means section 59
 * of the Act — the Regulation's own sections are always named as such ("Regulation section 4.5",
 * "sections 17.20 to 17.22 of the Regulation"). Getting that backwards would point a reader at a
 * section of the wrong enactment, so the default is the Act and only an explicit mention moves it.
 *
 * Subsections are dropped: an item is one whole section, so "Section 244 (1) (f)" is section 244.
 */
export function parseFormReference(reference: string | null): { act: string[]; reg: string[] } {
  const out = { act: [] as string[], reg: [] as string[] };
  if (!reference) return out;
  // A reference runs several clauses together, each naming one enactment. Split before a clause
  // that starts again with "section", and at the semicolons BC Laws uses between them.
  const clauses = reference.split(/;|(?=,\s*Regulation\s+sections?\b)|(?=\band\s+sections?\s+\d)/i);
  for (const clause of clauses) {
    const reg = /\bRegulation\s+sections?\b/i.test(clause) || /\bof the Regulation\b/i.test(clause);
    // Parenthesised subsections and paragraphs go first, so their numbers are not read as sections.
    const numbers = clause.replace(/\([^)]*\)/g, ' ');
    const found: string[] = [];
    numbers.split(/\s+to\s+/i).forEach((text, i) => {
      const nums = text.match(/\d+(?:\.\d+)?/g) ?? [];
      const last = found.at(-1);
      const first = nums[0];
      // "17.20 to 17.22": the range runs from the last number before "to" to the first after it.
      if (i > 0 && last !== undefined && first !== undefined) found.push(...between(last, first));
      found.push(...nums);
    });
    const into = reg ? out.reg : out.act;
    for (const n of found) if (!into.includes(n)) into.push(n);
  }
  return out;
}

/** The section numbers strictly between two endpoints of a range, where that can be counted. */
function between(from: string, to: string): string[] {
  const a = /^(\d+)(?:\.(\d+))?$/.exec(from);
  const b = /^(\d+)(?:\.(\d+))?$/.exec(to);
  if (!a || !b) return [];
  // "17.20 to 17.22" counts on the decimal part; "78 to 80" counts on the whole number. A range
  // that crosses from one to the other is not counted, and only its endpoints are kept.
  const decimal = a[2] !== undefined && b[2] !== undefined && a[1] === b[1];
  const whole = a[2] === undefined && b[2] === undefined;
  if (!decimal && !whole) return [];
  const lo = Number(decimal ? a[2] : a[1]);
  const hi = Number(decimal ? b[2] : b[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const out: string[] = [];
  for (let n = lo + 1; n < hi; n++) out.push(decimal ? `${a[1]}.${n}` : String(n));
  return out;
}
