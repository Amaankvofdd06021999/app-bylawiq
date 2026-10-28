export type Section = { heading: string; sectionRef: string; content: string; page: number };
/** Preserves headingless numeric provisions. No dependence on an HTML table of contents. */
export function structuralChunks(text: string): Section[] {
  const normalized = text.replaceAll('\r\n', '\n').replace(/\0/g, '').trim();
  if (!normalized) return [];
  const sections: Section[] = [];
  let current: Section = { heading: 'Document introduction', sectionRef: '', content: '', page: 1 };
  let page = 1;
  for (const raw of normalized.split('\n')) {
    if (raw.includes('\f')) page++;
    const line = raw.replaceAll('\f', '');
    const match = line.match(
      /^\s*(?:(Section|Bylaw|Rule|Part)\s+)?(\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)\s*([.\-–—:])?\s*(.{0,140})$/i,
    );
    const hasPrefix = Boolean(match?.[1]);
    const ref = match?.[2];
    const hasDelimiter = Boolean(match?.[3]);
    const title = match?.[4]?.trim() ?? '';
    const isValidHeading = Boolean(match && (hasPrefix || (title ? !/^[a-z]/.test(title) : hasDelimiter)));
    if (isValidHeading && ref && current.content.trim()) {
      sections.push({ ...current, content: current.content.trim() });
      current = { heading: line.trim(), sectionRef: ref, content: '', page };
    } else if (isValidHeading && ref) {
      current.heading = line.trim();
      current.sectionRef = ref;
      current.page = page;
    }
    current.content += line + '\n';
  }
  if (current.content.trim()) sections.push({ ...current, content: current.content.trim() });
  return sections.flatMap((s) => {
    if (s.content.length <= 5000) return [s];
    const result: Section[] = [];
    let buffer = '';
    for (const paragraph of s.content.split(/\n\s*\n/)) {
      if (buffer.length + paragraph.length > 5000 && buffer) {
        result.push({ ...s, content: buffer.trim() });
        buffer = '';
      }
      if (paragraph.length > 5000) {
        for (let i = 0; i < paragraph.length; i += 4500)
          result.push({ ...s, content: paragraph.slice(i, i + 4500) });
      } else buffer += paragraph + '\n\n';
    }
    if (buffer.trim()) result.push({ ...s, content: buffer.trim() });
    return result;
  });
}
export function contextualText(title: string, effectiveDate: string | null, section: Section) {
  return (
    '[' +
    title +
    ' · effective ' +
    (effectiveDate || 'unverified') +
    ']\n[' +
    section.heading +
    ']\n' +
    section.content
  );
}
