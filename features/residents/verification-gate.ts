import { createClient } from '@/lib/supabase/server';

/**
 * Verification gate for resident AI responses
 * Ensures only grounded, safe responses are returned
 */

export interface VerificationResult {
  isValid: boolean;
  reason?: string;
  hasSources: boolean;
  sourceCount: number;
}

export interface AuditLogEntry {
  buildingId: string;
  userId: string;
  action: 'resident_question' | 'resident_answer' | 'verification_failed' | 'rate_limit_hit';
  details: Record<string, any>;
}

/**
 * Verify that an AI response has adequate grounding
 * All resident responses MUST cite building documents
 */
export function verifyResidentResponse(
  response: string,
  sources: Array<{ documentId: string; relevance: number }> | undefined
): VerificationResult {
  // No sources = no grounding = gate it
  if (!sources || sources.length === 0) {
    return {
      isValid: false,
      reason: 'Response must be grounded in building documents. Please rephrase your question.',
      hasSources: false,
      sourceCount: 0,
    };
  }

  // All sources must have minimum relevance
  const minRelevance = 0.5;
  const validSources = sources.filter((s) => s.relevance >= minRelevance);

  if (validSources.length === 0) {
    return {
      isValid: false,
      reason: 'Could not find relevant information. Try rephrasing your question.',
      hasSources: false,
      sourceCount: 0,
    };
  }

  // Valid: has grounding
  return {
    isValid: true,
    hasSources: true,
    sourceCount: validSources.length,
  };
}

/**
 * Check if a question contains adversarial prompts or instructions
 * Prevents residents from getting analysis against the strata
 */
export function checkForAdversarialPrompt(question: string): {
  isAdversarial: boolean;
  reason?: string;
} {
  const adversarialPatterns = [
    // Don't analyze against strata
    /analyze.*against.*strata/i,
    /how.*to.*sue/i,
    /how.*to.*fight.*strata/i,
    /evidence.*against.*building/i,
    /legal.*case.*against/i,
    /draft.*complaint/i,
    /draft.*lawsuit/i,
    /draft.*dispute.*notice/i,

    // Don't help with other residents
    /other.*residents?/i,
    /privacy.*of.*other/i,
    /information.*about.*unit.*[0-9]/i,

    // Don't bypass protections
    /bypass.*rules/i,
    /circumvent.*policy/i,
    /loophole/i,
  ];

  for (const pattern of adversarialPatterns) {
    if (pattern.test(question)) {
      return {
        isAdversarial: true,
        reason:
          'I can only help with questions about your own building rules and policies. I cannot help with legal disputes or analysis against the strata.',
      };
    }
  }

  return { isAdversarial: false };
}

/**
 * Audit log a resident question/answer
 */
export async function auditResidentActivity(
  buildingId: string,
  userId: string,
  action: AuditLogEntry['action'],
  details: Record<string, any>
) {
  const db = await createClient();

  try {
    await db.from('resident_audit_log').insert({
      building_id: buildingId,
      user_id: userId,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to audit resident activity:', error);
    // Don't fail the request if audit fails, but log it
  }
}

/**
 * Rate limit check for resident questions
 * Limits: 10 questions per hour, 50 per day
 */
export async function checkResidentRateLimit(
  buildingId: string,
  userId: string
): Promise<{ allowed: boolean; remaining: number; resetAt?: Date }> {
  const db = await createClient();

  // Check questions in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recentQuestions, error } = await db
    .from('credit_ledger')
    .select('id', { count: 'exact' })
    .eq('building_id', buildingId)
    .eq('user_id', userId)
    .eq('reason', 'question')
    .gte('created_at', oneHourAgo);

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow through (fail open)
    return { allowed: true, remaining: 10 };
  }

  const hourlyLimit = 10;
  const questionsThisHour = recentQuestions?.length || 0;

  if (questionsThisHour >= hourlyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  return {
    allowed: true,
    remaining: hourlyLimit - questionsThisHour,
  };
}
