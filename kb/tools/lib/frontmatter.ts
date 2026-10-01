// Editing one field of an item's YAML frontmatter, leaving every other byte alone.
//
// Why not parse and re-serialise: the importer writes frontmatter as a fixed list of plain lines,
// and a YAML round trip would reformat quoting, ordering and line breaks across hundreds of files,
// burying a one-field change in noise. These edits are line edits on purpose.

/** The frontmatter block, which is the text between the opening `---` and the next `---` line. */
function frontmatterEnd(text: string): number {
  const close = text.startsWith('---\n') ? text.indexOf('\n---', 3) : -1;
  if (close === -1) throw new Error('missing YAML frontmatter');
  return close;
}

/** Replaces `key: …` inside the frontmatter. Throws if the field is not there, rather than adding it. */
export function setFrontmatterField(text: string, key: string, value: string): string {
  const close = frontmatterEnd(text);
  const head = text.slice(0, close);
  const line = new RegExp(`^${key}: .*$`, 'm');
  if (!line.test(head)) throw new Error(`frontmatter has no ${key} field`);
  return head.replace(line, `${key}: ${value}`) + text.slice(close);
}

/** Reads `key: …` from the frontmatter, or null when the field is absent. */
export function getFrontmatterField(text: string, key: string): string | null {
  const head = text.slice(0, frontmatterEnd(text));
  const m = new RegExp(`^${key}: (.*)$`, 'm').exec(head);
  return m ? m[1] : null;
}
