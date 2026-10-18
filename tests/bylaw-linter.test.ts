import { describe, expect, it } from 'vitest';
import { LINTER_CONFIG, LINTER_RULES_VERSION, lintBylaw, type LintRuleId } from '@/lib/bylaw-linter';

const rules = (body: string, isAmendment = false) =>
  lintBylaw(body, { isAmendment }).findings.map((f) => f.rule as LintRuleId);

describe('linter: deterministic output and versioning', () => {
  it('gives the same findings for the same text', () => {
    const body = 'Owners pay a $500 fine for any contravention.';
    expect(lintBylaw(body, { isAmendment: false })).toEqual(lintBylaw(body, { isAmendment: false }));
  });

  it('reports the rules version it was run with', () => {
    expect(lintBylaw('', { isAmendment: false }).rulesVersion).toBe(LINTER_RULES_VERSION);
  });

  it('passes a clean bylaw with no findings', () => {
    const result = lintBylaw('Quiet hours run from 10 pm to 7 am.', { isAmendment: false });
    expect(result.findings).toEqual([]);
    expect(result.canPropose).toBe(true);
  });
});

describe('R1 fine cap (blocker)', () => {
  it('blocks a contravention fine above the cap', () => {
    const result = lintBylaw('A contravention carries a $500 fine.', { isAmendment: false });
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        rule: 'fine_cap',
        severity: 'blocker',
        matched: 'A contravention carries a $500 fine.',
      }),
    );
    expect(result.canPropose).toBe(false);
  });

  it('allows a fine exactly at the cap', () => {
    expect(rules('A contravention carries a $200 fine.')).not.toContain('fine_cap');
  });

  it('blocks a fine one cent above the cap', () => {
    expect(rules('A fine of $200.01 applies.')).toContain('fine_cap');
  });

  it('reads amounts with thousands separators', () => {
    expect(rules('A penalty of $1,250 applies.')).toContain('fine_cap');
  });

  it('ignores an amount that is not a fine', () => {
    expect(rules('The gym deposit is $500.')).not.toContain('fine_cap');
  });

  it('uses the configured cap', () => {
    expect(LINTER_CONFIG.contraventionFineCapCents).toBe(20_000);
  });
});

describe('R2 rental restriction (blocker)', () => {
  it('blocks a rental prohibition', () => {
    expect(rules('Owners must not rent their units to tenants.')).toContain('rental_restriction');
  });

  it('allows a sentence that mentions rentals without restricting them', () => {
    expect(rules('Rental income is reported annually.')).not.toContain('rental_restriction');
  });

  it('is a blocker', () => {
    const result = lintBylaw('No rentals are permitted.', { isAmendment: false });
    expect(result.findings.find((f) => f.rule === 'rental_restriction')?.severity).toBe('blocker');
  });
});

describe('R3 age restriction (blocker)', () => {
  it('blocks a minimum age other than 55', () => {
    expect(rules('Residents must be 18 years of age or older.')).toContain('age_restriction');
  });

  it('allows the permitted 55 and over restriction', () => {
    expect(rules('The building is for residents aged 55 years and over.')).not.toContain('age_restriction');
  });

  it('does not flag a sentence with no age', () => {
    expect(rules('Owners must keep the hallway clear.')).not.toContain('age_restriction');
  });
});

describe('R4 service animals (blocker)', () => {
  it('blocks a pet prohibition with no service-animal exception', () => {
    expect(rules('No pets are permitted in the building.')).toContain('service_animal');
  });

  it('allows a pet prohibition that states the service-animal exception', () => {
    expect(rules('No pets are permitted, except service animals.')).not.toContain('service_animal');
  });

  it('does not flag pets that are allowed', () => {
    expect(rules('Two pets per unit are permitted.')).not.toContain('service_animal');
  });
});

describe('R5 enforcement procedure (warning)', () => {
  it('warns when a fine is set with no s.135 reference', () => {
    const result = lintBylaw('A $100 fine applies to noise.', { isAmendment: false });
    expect(result.findings.find((f) => f.rule === 'enforcement_procedure')?.severity).toBe('warning');
  });

  it('does not warn when the s.135 procedure is referenced', () => {
    expect(rules('A $100 fine applies to noise, under section 135.')).not.toContain('enforcement_procedure');
  });

  it('does not warn when no fine is set', () => {
    expect(rules('Quiet hours run from 10 pm to 7 am.')).not.toContain('enforcement_procedure');
  });
});

describe('R6 vague standard (info)', () => {
  it('notes an undefined standard', () => {
    expect(rules('Excessive noise is not permitted.')).toContain('vague_standard');
  });

  it('does not note a standard that is defined', () => {
    expect(
      rules('Excessive noise means noise above 60 decibels. Excessive noise is not permitted.'),
    ).not.toContain('vague_standard');
  });
});

describe('R7 vote threshold (info, amendments only)', () => {
  it('notes a majority wording on an amendment', () => {
    const result = lintBylaw('A majority vote amends this bylaw.', { isAmendment: true });
    expect(result.findings.find((f) => f.rule === 'vote_threshold')?.severity).toBe('info');
  });

  it('does not run on a new bylaw', () => {
    expect(rules('A majority vote amends this bylaw.', false)).not.toContain('vote_threshold');
  });
});

describe('R8 filing step (info, amendments only)', () => {
  it('reminds that an amendment is not effective until filed', () => {
    expect(rules('Quiet hours run from 10 pm to 7 am.', true)).toContain('filing_step');
  });

  it('is not shown for a new bylaw', () => {
    expect(rules('Quiet hours run from 10 pm to 7 am.', false)).not.toContain('filing_step');
  });
});

describe('gating', () => {
  it('cannot propose while any blocker is present, even with other findings', () => {
    const result = lintBylaw('Pets are prohibited. A $500 fine applies.', { isAmendment: true });
    expect(result.findings.some((f) => f.severity === 'blocker')).toBe(true);
    expect(result.canPropose).toBe(false);
  });

  it('can propose with warnings and info only', () => {
    const result = lintBylaw('Excessive noise is not permitted under section 135.', { isAmendment: false });
    expect(result.findings.every((f) => f.severity !== 'blocker')).toBe(true);
    expect(result.canPropose).toBe(true);
  });
});
