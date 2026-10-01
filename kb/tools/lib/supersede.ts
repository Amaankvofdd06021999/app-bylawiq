// Keeping the previous text of a section when BC Laws publishes a new one.
//
// The problem this solves: before this, a section whose text changed was simply overwritten and sent
// back to draft. The old text was gone, so a question about what the rule was last year could not be
// answered, and a notice sent under the old rule could not be checked against it.
//
// The shape: the stable id always holds the text in force now. The previous text is written to
// `superseded/<section>.<date>.md` under a dated id, with `in_force_to` set, and the new item points
// at it through `supersedes`. The app's `hybrid_search_legal` filters on `in_force_from` and
// `in_force_to` against the question's "as of" date, so an archived version stops answering
// questions about today the moment `in_force_to` is set, and starts answering questions about the
// period it covered.
//
// The honest limit: `in_force_to` is the consolidation date on which the change was *found*, not the
// date the amendment came into force. We do not hold in-force dates (research tasks A2, open
// questions 21 and 25). Leaving it null would be worse — both versions would answer questions about
// today, which is how an answer ends up citing a rule that no longer applies — so an approximate end
// date is set and labelled as one, in the item's notes and in the import report, for a researcher to
// correct.
import { setFrontmatterField } from './frontmatter.ts';

/** `bc.spa.s135` + `2026-09-22` -> `bc.spa.s135.2026-09-22`. Never reuses the stable id. */
export function supersededId(id: string, consolidationDate: string): string {
  return `${id}.${consolidationDate}`;
}

/**
 * Where the previous text goes: a `superseded/` folder beside the Part folders, so the Part folders
 * stay one-file-per-current-section and `staleItems()` in the importer has nothing new to report.
 */
export function supersededPath(folder: string, itemPath: string, consolidationDate: string): string {
  const file = itemPath.slice(itemPath.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return `${folder}/superseded/${file}.${consolidationDate}.md`;
}

const NOTE = 'This is the previous text, kept so a question about an earlier date can still be '
  + 'answered. in_force_to is the consolidation date on which this text was found to have changed, '
  + 'not the date the amendment came into force: correct it from the Tables of Legislative Changes '
  + '(research task A2).';

/**
 * Turns an item's current file content into the archived copy of it: a dated id, `in_force_to` set,
 * and the note above added. Status and review sign-off are kept deliberately — the review was a
 * review of *this* text, and it is still true of it.
 */
export function archiveItem(text: string, opts: { id: string; inForceTo: string }): string {
  let out = setFrontmatterField(text, 'id', opts.id);
  out = setFrontmatterField(out, 'in_force_to', opts.inForceTo);
  const notes = /^notes: (.*)$/m.exec(out.slice(0, out.indexOf('\n---', 3)));
  const existing = notes ? notes[1].trim() : 'null';
  const quoted = existing === 'null' || existing === '' ? '' : existing.replace(/^"|"$/g, '') + ' ';
  return setFrontmatterField(out, 'notes', `"${quoted}${NOTE}"`);
}

/**
 * The lines that left and the lines that arrived, for the import report. Not a true diff: it is a
 * set difference by line, which is enough for a reviewer to see what moved and cheap enough to run
 * over every changed section. Capped so one rewritten section cannot bury the rest of the report.
 */
export function changedLines(before: string, after: string, cap = 12): string[] {
  const split = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const beforeLines = split(before);
  const afterLines = split(after);
  const afterSet = new Set(afterLines);
  const beforeSet = new Set(beforeLines);
  const removed = beforeLines.filter((l) => !afterSet.has(l)).map((l) => `- ${l}`);
  const added = afterLines.filter((l) => !beforeSet.has(l)).map((l) => `+ ${l}`);
  const all = [...removed, ...added];
  if (all.length <= cap) return all;
  return [...all.slice(0, cap), `  … ${all.length - cap} more changed line(s)`];
}
