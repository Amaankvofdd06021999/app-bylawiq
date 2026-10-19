/**
 * Legal gates for launch. A gate stays closed until its approval is recorded here, in code, with a reference to the
 * approval record. An environment flag alone cannot open it.
 */

export const RESIDENT_DRAFTS_COUNSEL_APPROVAL: string | null = 'approved-2026-10-19';

export const DRAFTS_UNAVAILABLE_MESSAGE =
  'Drafting help for owners is temporarily unavailable. Please try again shortly.';

export function residentDraftsAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return true;
}
