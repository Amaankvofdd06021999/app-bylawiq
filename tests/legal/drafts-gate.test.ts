// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  RESIDENT_DRAFTS_COUNSEL_APPROVAL,
  residentDraftsAvailable,
} from '@/lib/legal-gates';

describe('resident drafts gate', () => {
  it('is approved and available for residents', () => {
    expect(RESIDENT_DRAFTS_COUNSEL_APPROVAL).not.toBeNull();
    expect(residentDraftsAvailable()).toBe(true);
  });
});
