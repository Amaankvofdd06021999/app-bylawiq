/**
 * Legal gates for launch. A gate stays closed until its approval is recorded here, in code, with a reference to the
 * approval record. An environment flag alone cannot open it.
 */

/** Resident-facing drafting help (decision D5). Counsel has not approved it: keep this `null` until they do. */
export const RESIDENT_DRAFTS_COUNSEL_APPROVAL: string | null = null;

export const DRAFTS_UNAVAILABLE_MESSAGE =
  'Drafting help for owners is not available yet. It needs legal approval before it can be used. Nothing was charged.';

export function residentDraftsAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return RESIDENT_DRAFTS_COUNSEL_APPROVAL !== null && env.RESIDENT_DRAFTS_ENABLED === 'on';
}
