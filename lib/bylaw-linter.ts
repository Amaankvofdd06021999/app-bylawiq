/**
 * Deterministic compliance linter for a bylaw's text (PRD §6.4). Pure: no model, no I/O, no database. The same text always
 * gives the same findings.
 *
 * The output is a set of checks for a person to read. It is not legal advice and not legal approval. Each rule's legal
 * basis, and every number in CONFIG, must be confirmed by counsel before the rules are relied on. See docs/LINTER-RULES.md.
 */

export const LINTER_RULES_VERSION = '2026-10-17-draft';

/** Values counsel must confirm. Changing one of these is a reviewed change, and bumps LINTER_RULES_VERSION. */
export const LINTER_CONFIG = {
  /** Maximum contravention fine, in cents. The PRD gives $200 as the example; counsel confirms the current cap and section. */
  contraventionFineCapCents: 20_000,
  /** The one age restriction the PRD allows after Bill 44: 55 and over, for seniors housing. Counsel confirms. */
  permittedMinimumAge: 55,
} as const;

export type LintSeverity = 'blocker' | 'warning' | 'info';
export type LintRuleId =
  | 'fine_cap'
  | 'rental_restriction'
  | 'age_restriction'
  | 'service_animal'
  | 'enforcement_procedure'
  | 'vague_standard'
  | 'vote_threshold'
  | 'filing_step';

export type LintFinding = {
  rule: LintRuleId;
  severity: LintSeverity;
  message: string;
  /** The sentence that triggered the rule, so a reader can see what was matched. */
  matched: string;
};

export type LintResult = {
  rulesVersion: typeof LINTER_RULES_VERSION;
  findings: LintFinding[];
  /** False while any blocker is present. A blocker can be overridden with a typed justification, recorded elsewhere. */
  canPropose: boolean;
};

export type LintOptions = {
  /** True for an amendment to a bylaw that is already in force. Enables the amendment-only checks. */
  isAmendment: boolean;
};

const SENTENCE_BREAK = /(?<=[.;!?])\s+|\n+/;

function sentences(text: string): string[] {
  return text
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A dollar amount in cents. "$1,250.50" becomes 125050. Returns null when no amount is found. */
function dollarAmountsInCents(sentence: string): number[] {
  const amounts: number[] = [];
  for (const match of sentence.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g)) {
    const whole = Number(match[1].replace(/,/g, ''));
    const cents = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
    amounts.push(whole * 100 + cents);
  }
  return amounts;
}

const FINE_WORD = /\b(fine|fines|penalty|penalties|contravention)\b/i;
const PROHIBITION =
  /\b(prohibit\w*|forbid\w*|not (?:be )?(?:permitted|allowed)|restrict\w*|must not|shall not)\b/i;
const RENTAL_NOUN = 'rent|rents|rental|rentals|rented|renting|tenant|tenants|tenancy|lease|leases|leased';
const PET_NOUN = 'pet|pets|animal|animals|dog|dogs|cat|cats';
const RENTAL_WORD = new RegExp(`\\b(${RENTAL_NOUN})\\b`, 'i');
const PET_WORD = new RegExp(`\\b(${PET_NOUN})\\b`, 'i');
const AGE_WORD = /\b(age|aged|minimum age|over|under|years? of age|and over|and older|or older)\b/i;

/** A prohibition on a noun: "prohibit...", "not permitted", or "no rentals" / "no pets" (with up to one word between). */
function prohibits(sentence: string, noun: string): boolean {
  return PROHIBITION.test(sentence) || new RegExp(`\\bno\\s+(?:\\w+\\s+)?(?:${noun})\\b`, 'i').test(sentence);
}
const SERVICE_ANIMAL = /\b(service animals?|assistance animals?|guide dogs?|support animals?)\b/i;
const ENFORCEMENT = /\b(section 135|s\.\s?135)\b/i;
const VAGUE_WORD = /\b(excessive|unreasonabl\w*|reasonabl\w*|nuisance|disturb\w*)\b/i;
const DEFINITION = /\b(means|defined as|includes|including)\b/i;
const MAJORITY = /\bmajority\b/i;

export function lintBylaw(body: string, options: LintOptions): LintResult {
  const parts = sentences(body);
  const whole = body;
  const findings: LintFinding[] = [];

  // R1: fine above the contravention cap (blocker).
  for (const s of parts) {
    if (!FINE_WORD.test(s)) continue;
    for (const cents of dollarAmountsInCents(s)) {
      if (cents > LINTER_CONFIG.contraventionFineCapCents) {
        findings.push({
          rule: 'fine_cap',
          severity: 'blocker',
          message: `The fine of $${(cents / 100).toFixed(2)} is above the maximum of $${(LINTER_CONFIG.contraventionFineCapCents / 100).toFixed(2)} for a contravention (s.130, counsel to confirm).`,
          matched: s,
        });
        break;
      }
    }
  }

  // R2: rental restriction, unenforceable after Bill 44 (blocker).
  for (const s of parts) {
    if (RENTAL_WORD.test(s) && prohibits(s, RENTAL_NOUN)) {
      findings.push({
        rule: 'rental_restriction',
        severity: 'blocker',
        message:
          'Rental restrictions are unenforceable under s.126 following Bill 44 (2022), counsel to confirm.',
        matched: s,
      });
    }
  }

  // R3: age restriction other than the permitted minimum (blocker).
  for (const s of parts) {
    if (!AGE_WORD.test(s)) continue;
    for (const match of s.matchAll(/\b(\d{1,3})\s*(?:years?|yrs?)\b/gi)) {
      const age = Number(match[1]);
      if (age !== LINTER_CONFIG.permittedMinimumAge) {
        findings.push({
          rule: 'age_restriction',
          severity: 'blocker',
          message: `An age restriction of ${age} is not permitted. Bill 44 removed age restrictions except 55 and over for seniors housing (counsel to confirm).`,
          matched: s,
        });
        break;
      }
    }
  }

  // R4: pet prohibition with no service-animal exception (blocker).
  const prohibitsAnimals = parts.some((s) => PET_WORD.test(s) && prohibits(s, PET_NOUN));
  if (prohibitsAnimals && !SERVICE_ANIMAL.test(whole)) {
    const matched = parts.find((s) => PET_WORD.test(s) && prohibits(s, PET_NOUN)) ?? '';
    findings.push({
      rule: 'service_animal',
      severity: 'blocker',
      message:
        'A pet prohibition without a service-animal exception is unenforceable. Human Rights Code s.4 prevails (counsel to confirm).',
      matched,
    });
  }

  // R5: fines or penalties with no reference to the s.135 procedure (warning).
  if (parts.some((s) => FINE_WORD.test(s)) && !ENFORCEMENT.test(whole)) {
    findings.push({
      rule: 'enforcement_procedure',
      severity: 'warning',
      message:
        'This creates an obligation or a fine with no enforcement procedure. The s.135 procedure applies to any fine.',
      matched: parts.find((s) => FINE_WORD.test(s)) ?? '',
    });
  }

  // R6: a vague standard with no definition (info).
  for (const s of parts) {
    if (VAGUE_WORD.test(s) && !DEFINITION.test(whole)) {
      findings.push({
        rule: 'vague_standard',
        severity: 'info',
        message:
          'A standard such as "excessive" or "unreasonable" is used without a definition. Consider stating the standard.',
        matched: s,
      });
      break;
    }
  }

  // R7: amendments need a three-quarter vote, not a majority (info, amendments only).
  if (options.isAmendment) {
    const majority = parts.find((s) => MAJORITY.test(s));
    if (majority) {
      findings.push({
        rule: 'vote_threshold',
        severity: 'info',
        message:
          'Amendments to bylaws need a three-quarter vote (s.53), not a majority. Check the threshold on the agenda (counsel to confirm).',
        matched: majority,
      });
    }
  }

  // R8: an amendment is not effective until filed (info, amendments only).
  if (options.isAmendment) {
    findings.push({
      rule: 'filing_step',
      severity: 'info',
      message:
        'This amendment is not effective until it is filed at the Land Title Office (s.128). Record the filing after adoption.',
      matched: '',
    });
  }

  return {
    rulesVersion: LINTER_RULES_VERSION,
    findings,
    canPropose: !findings.some((f) => f.severity === 'blocker'),
  };
}
