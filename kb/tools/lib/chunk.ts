// Section-aware chunking. Splits on Markdown headings first, then on paragraphs,
// then on sentences, and only hard-cuts text as a last resort.

export const DEFAULT_MAX_CHARS = 1200;

export type Chunk = {
  chunk_id: string;
  /** Heading path from the top of the item, for example "Part 7 > Section 135 > (1)". Null before the first heading. */
  section_ref: string | null;
  /** The nearest heading, or null before the first heading. */
  heading: string | null;
  content: string;
};

type Section = { path: string[]; heading: string | null; text: string };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Splits a Markdown body into sections, one per heading. Ignores headings inside fenced code. */
export function splitSections(body: string): Section[] {
  const sections: Section[] = [];
  const stack: { level: number; text: string }[] = [];
  let current: Section = { path: [], heading: null, text: '' };
  let inFence = false;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    const m = inFence ? null : HEADING.exec(line);
    if (m) {
      sections.push(current);
      const level = m[1].length;
      const text = m[2].trim();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text });
      current = { path: stack.map((s) => s.text), heading: text, text: '' };
    } else {
      current.text += line + '\n';
    }
  }
  sections.push(current);
  return sections.filter((s) => s.text.trim().length > 0);
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?;]+[.!?;]+(\s+|$)|[^.!?;]+$/g) ?? [text];
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (s.length > max) {
      if (buf) out.push(buf.trim());
      buf = '';
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
      continue;
    }
    if ((buf + s).length > max && buf) {
      out.push(buf.trim());
      buf = '';
    }
    buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** Greedily packs paragraphs into pieces no longer than max characters. */
export function packParagraphs(text: string, max: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    for (const piece of splitLong(p, max)) {
      const joined = buf ? `${buf}\n\n${piece}` : piece;
      if (joined.length > max && buf) {
        out.push(buf);
        buf = piece;
      } else {
        buf = joined;
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function chunkBody(itemId: string, body: string, max = DEFAULT_MAX_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  for (const section of splitSections(body)) {
    for (const content of packParagraphs(section.text, max)) {
      chunks.push({
        chunk_id: `${itemId}#${String(chunks.length + 1).padStart(3, '0')}`,
        section_ref: section.path.length ? section.path.join(' > ') : null,
        heading: section.heading,
        content,
      });
    }
  }
  return chunks;
}
