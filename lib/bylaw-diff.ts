/**
 * Word-level diff between two versions of a bylaw. Pure: no I/O, so the server and the browser can both use it.
 *
 * Tokens are words and the whitespace between them, so spacing changes show up and the output rebuilds both inputs
 * exactly. A diff that would need more than MAX_CELLS table cells falls back to replacing the whole body. The caller then
 * shows the old and new text in full, instead of the page doing a very large computation.
 */

export type DiffSegment = { kind: 'same' | 'added' | 'removed'; text: string };
export type BylawDiff = { segments: DiffSegment[]; truncated: boolean };

const MAX_CELLS = 4_000_000;

function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function push(segments: DiffSegment[], kind: DiffSegment['kind'], text: string) {
  const last = segments[segments.length - 1];
  if (last && last.kind === kind) last.text += text;
  else segments.push({ kind, text });
}

export function diffBylawText(oldText: string, newText: string): BylawDiff {
  if (oldText === newText)
    return { segments: oldText ? [{ kind: 'same', text: oldText }] : [], truncated: false };

  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length * b.length > MAX_CELLS) {
    const segments: DiffSegment[] = [];
    if (oldText) segments.push({ kind: 'removed', text: oldText });
    if (newText) segments.push({ kind: 'added', text: newText });
    return { segments, truncated: true };
  }

  // Longest common subsequence over tokens, filled from the end so the walk below reads forwards.
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(segments, 'same', a[i]);
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      push(segments, 'removed', a[i]);
      i++;
    } else {
      push(segments, 'added', b[j]);
      j++;
    }
  }
  while (i < n) push(segments, 'removed', a[i++]);
  while (j < m) push(segments, 'added', b[j++]);

  return { segments, truncated: false };
}
