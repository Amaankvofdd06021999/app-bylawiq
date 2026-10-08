import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import type { Source } from '@/lib/ai/citations';

/**
 * Verification gate for resident AI responses
 * Ensures: grounding, no cross-building leakage, appropriate tone, citations valid
 */

export interface VerificationGateInput {
  userId: string;
  buildingId: string;
  query: string;
  answer: string;
  sources: Source[];
  tokens: number;
}

export interface GateResult {
  passed: boolean;
  issues: string[];
  reason?: string;
}

/**
 * Comprehensive verification gate for resident responses
 */
export async function verifyResidentResponse(input: VerificationGateInput): Promise<GateResult> {
  const issues: string[] = [];
  const db = await createClient();

  try {
    // Check 1: Grounding — answer must cite at least one source
    const hasCitations = /\[\d+\]/.test(input.answer);
    if (!hasCitations) {
      issues.push('No citations found in answer');
    }

    // Check 2: Source validity — all cited numbers must resolve to actual sources
    const citationMatches = input.answer.match(/\[\d+\]/g) || [];
    const citedIndices = new Set(
      citationMatches.map((c) => parseInt(c.slice(1, -1)))
    );

    for (const idx of citedIndices) {
      if (idx < 1 || idx > input.sources.length) {
        issues.push(`Citation [${idx}] references non-existent source`);
      }
    }

    // Check 3: Cross-building leakage — all sources must be from the user's building
    for (const source of input.sources) {
      if (source.kind === 'building' && source.buildingId !== input.buildingId) {
        issues.push(`Source from unauthorized building: ${source.buildingId}`);
        // CRITICAL: Log this as a potential breach
        await logSecurityEvent(db, {
          userId: input.userId,
          buildingId: input.buildingId,
          eventType: 'cross_building_leak_attempt',
          details: { unauthorizedBuildingId: source.buildingId },
        });
      }
    }

    // Check 4: Tone — ensure response doesn't contain legal advice disclaimers violations
    const legalAdvicePatterns = [
      /this is legal advice/i,
      /you should consult a lawyer/i,
      /i am a lawyer/i,
      /licensed attorney/i,
    ];

    for (const pattern of legalAdvicePatterns) {
      if (pattern.test(input.answer)) {
        issues.push('Response contains improper legal advice claims');
      }
    }

    // Check 5: Length reasonableness
    if (input.answer.length < 50) {
      issues.push('Answer too short to be substantive');
    }
    if (input.answer.length > 10000) {
      issues.push('Answer too long');
    }

    // Check 6: No parametric knowledge (common patterns of hallucination)
    const hallucination_patterns = [
      /(?<!the|building|s\.)maximum fine is \$\d+/i, // Amount without context
      /typically.*buildings require/i, // Generic assumption
      /in most cases/i, // Over-generalization
    ];

    for (const pattern of hallucination_patterns) {
      if (pattern.test(input.answer)) {
        issues.push('Response appears to use unsourced general knowledge');
      }
    }

    const passed = issues.length === 0;

    // Log verification result
    await logVerificationEvent(db, {
      userId: input.userId,
      buildingId: input.buildingId,
      queryLength: input.query.length,
      sourceCount: input.sources.length,
      passed,
      issueCount: issues.length,
      tokens: input.tokens,
    });

    return {
      passed,
      issues,
      reason: passed ? undefined : issues[0], // Return first issue for UI
    };
  } catch (error) {
    logger.error({
      userId: input.userId,
      buildingId: input.buildingId,
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'resident_verification_gate',
    });

    // On error, fail closed (safer for legal content)
    return {
      passed: false,
      issues: ['Verification system error'],
      reason: 'Response could not be verified. Please try again.',
    };
  }
}

/**
 * Log resident Q&A to audit trail + handle refunds
 */
export async function auditResidentQA(input: {
  userId: string;
  buildingId: string;
  query: string;
  answer: string;
  sources: Source[];
  gateResult: GateResult;
  tokens: number;
  cost: number;
}): Promise<void> {
  const db = await createClient();

  try {
    const sourceIds = input.sources.map((s) => s.chunkId);
    const sourceCount = input.sources.length;

    // If gate failed, refund the credits
    if (!input.gateResult.passed && input.cost > 0) {
      try {
        await db.from('resident_wallets').update({
          credits: db.raw('credits + ?', [input.cost]),
        }).eq('user_id', input.userId)
          .eq('building_id', input.buildingId);

        // Log refund
        const { error: refundError } = await db.from('credit_ledger').insert({
          user_id: input.userId,
          building_id: input.buildingId,
          delta: input.cost,
          reason: 'verification_failed_refund',
          metadata: { original_cost: input.cost, issues: input.gateResult.issues },
        });
      } catch (refundError) {
        logger.error({
          userId: input.userId,
          buildingId: input.buildingId,
          error: refundError instanceof Error ? refundError.message : 'Unknown',
          context: 'refund_verification_failed',
        });
      }
    }

    await db.from('resident_audit_log').insert({
      user_id: input.userId,
      building_id: input.buildingId,
      action: input.gateResult.passed ? 'resident_answer' : 'verification_failed',
      details: {
        query_preview: input.query.slice(0, 200),
        answer_length: input.answer.length,
        source_count: sourceCount,
        sources: sourceIds,
        gate_passed: input.gateResult.passed,
        gate_issues: input.gateResult.issues,
        tokens,
        cost,
        refunded: !input.gateResult.passed && input.cost > 0,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      userId: input.userId,
      buildingId: input.buildingId,
      error: error instanceof Error ? error.message : 'Unknown',
      context: 'audit_resident_qa',
    });
  }
}

/**
 * Log rate limit hits
 */
export async function auditRateLimit(input: {
  userId: string;
  buildingId: string;
  limitType: 'hourly' | 'daily';
  attemptedAt: string;
}): Promise<void> {
  const db = await createClient();

  try {
    await db.from('resident_audit_log').insert({
      user_id: input.userId,
      building_id: input.buildingId,
      action: 'rate_limit_hit',
      details: {
        limit_type: input.limitType,
        attempted_at: input.attemptedAt,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      userId: input.userId,
      context: 'audit_rate_limit',
    });
  }
}

/**
 * Log verification events for monitoring
 */
async function logVerificationEvent(
  db: Awaited<ReturnType<typeof createClient>>,
  data: {
    userId: string;
    buildingId: string;
    queryLength: number;
    sourceCount: number;
    passed: boolean;
    issueCount: number;
    tokens: number;
  }
): Promise<void> {
  try {
    await db.from('verification_gate_events').insert({
      user_id: data.userId,
      building_id: data.buildingId,
      query_length: data.queryLength,
      source_count: data.sourceCount,
      passed: data.passed,
      issue_count: data.issueCount,
      tokens: data.tokens,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ context: 'log_verification_event', error });
  }
}

/**
 * Log security events (potential attacks, cross-building leaks, etc.)
 */
async function logSecurityEvent(
  db: Awaited<ReturnType<typeof createClient>>,
  data: {
    userId: string;
    buildingId: string;
    eventType: string;
    details: Record<string, any>;
  }
): Promise<void> {
  try {
    await db.from('security_events').insert({
      user_id: data.userId,
      building_id: data.buildingId,
      event_type: data.eventType,
      details: data.details,
      created_at: new Date().toISOString(),
    });

    logger.error({
      userId: data.userId,
      buildingId: data.buildingId,
      eventType: data.eventType,
      context: 'security_event',
    });
  } catch (error) {
    logger.error({ context: 'log_security_event', error });
  }
}
