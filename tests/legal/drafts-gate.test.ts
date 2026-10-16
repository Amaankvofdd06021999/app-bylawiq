// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DRAFTS_UNAVAILABLE_MESSAGE,
  RESIDENT_DRAFTS_COUNSEL_APPROVAL,
  residentDraftsAvailable,
} from '@/lib/legal-gates';

describe('resident drafts gate (decision D5)', () => {
  it('is closed while counsel has not recorded an approval, whatever the environment says', () => {
    expect(RESIDENT_DRAFTS_COUNSEL_APPROVAL).toBeNull();
    expect(residentDraftsAvailable({ RESIDENT_DRAFTS_ENABLED: 'on' })).toBe(false);
  });

  it('is closed by default, with no environment flag', () => {
    expect(residentDraftsAvailable({})).toBe(false);
  });

  it('tells the user it needs legal approval, and that nothing was charged', () => {
    expect(DRAFTS_UNAVAILABLE_MESSAGE).toMatch(/legal approval/);
    expect(DRAFTS_UNAVAILABLE_MESSAGE).toMatch(/Nothing was charged/);
  });
});
