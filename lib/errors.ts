import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Please sign in to continue.') {
    super('unauthorized', message, 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission for this action.') {
    super('forbidden', message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'This item is unavailable.') {
    super('not_found', message, 404);
  }
}
export class FeatureUnavailableError extends AppError {
  constructor(message = 'This feature is not available in this release.') {
    super('feature_unavailable', message, 403);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('rate_limited', 'Too many requests. Please try again in a minute.', 429);
  }
}
export function checkDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  const safe: Record<string, string> = {
    single_building_conflict:
      'This email already belongs to another single-building account. Use a separate plus-addressed email, or have the administrator provision a portfolio account.',
    single_building_bound: 'This account is permanently assigned to one building.',
    self_approval_not_permitted: 'Another authorized reviewer must approve this notice.',
    knowledge_not_ready: 'Add and finish indexing a knowledge source before deploying.',
    legal_review_required: 'Arrange legal review or record a specific justification before proposing.',
    invalid_transition: 'This action is not available at the current stage.',
    not_yet_effective:
      'This bylaw takes effect on its effective date. Move it in force on or after that date.',
    review_required: 'Choose a legal review option first.',
    invalid_filing_reference:
      'Enter the LTO filing reference: 3 to 30 letters, digits, hyphens or slashes, with at least one digit.',
    effective_date_required: 'Enter the date the amendment takes effect.',
    counsel_account_required:
      'This person needs a BylawIQ account before counsel access can be granted. Ask them to sign up, then try again.',
    invalid_period: 'Counsel access can run for 1 to 30 days.',
    notice_not_approved: 'Only an approved notice can be sent to residents.',
    invalid_batch: 'Choose a smaller batch.',
    counsel_required: 'Enter the counsel’s email address.',
    counsel_grants_active_idx:
      'Counsel already has active access to this amendment. Revoke it first to change the period.',
    already_revoked: 'This access has already been ended.',
    already_configured: 'This account is already configured.',
    already_member:
      'This person is already a member of this building. Change their role from Members instead.',
    no_firm_link: 'Link a strata management firm before sending this for review.',
    comment_required: 'Add a comment explaining what needs to change.',
    firm_review_pending: 'The firm is reviewing this document. Wait for their decision.',
    invalid_code: 'That code isn’t valid. Check it and try again.',
    revoked_code: 'That code was replaced or cancelled. Ask the building for a new one.',
    expired_code: 'That code has expired. Ask the building for a new one.',
    wrong_code_kind: 'That’s a resident code. Ask the building for a strata management code.',
    firm_already_linked:
      'This building already has a strata management firm. The building must remove that firm first.',
    linked_member: 'Strata management access is managed as a whole. Remove the firm from Settings instead.',
    invalid_input: 'Check the details and try again.',
    invalid_invitation:
      'This invitation can’t be used. It may have expired, been used already, been cancelled, or been sent to a different email address. Ask the building for a new one.',
    unit_mismatch: 'The unit doesn’t match what the resident entered. Check the unit with the resident.',
    invitation_unavailable: 'This invitation is no longer valid. Ask for a new one.',
    invitation_email_mismatch:
      'This invitation was sent to a different email address. Sign in with that address to accept it.',
    cannot_remove_self: 'You cannot remove yourself from the firm.',
    invalid_expiry: 'Choose an expiry within 30 days.',
  };
  for (const [key, message] of Object.entries(safe))
    if (error.message.includes(key)) throw new AppError(key, message, 409);
  if (error.code === '42501' || error.message.includes('forbidden')) throw new ForbiddenError();
  if (error.code === '23505')
    throw new AppError('conflict', 'This item already exists, or a request is already running.', 409);
  // Operators get the database code and a truncated message. Neither carries row content; the user sees generic text.
  logger.error({ context: 'db_error', dbCode: error.code ?? 'none', error: error.message.slice(0, 200) });
  throw new AppError('database_error', 'The change could not be saved. Please try again.', 500);
}
export function errorMessage(e: unknown) {
  return e instanceof AppError
    ? e.message
    : e instanceof ZodError
      ? 'Check the highlighted fields and try again.'
      : 'Something went wrong. Please try again.';
}
export function errorResponse(e: unknown) {
  const status = e instanceof AppError ? e.status : e instanceof ZodError ? 400 : 500;
  if (status >= 500)
    logger.error({ context: 'route_error', error: e instanceof Error ? e.message : 'unknown' });
  return Response.json({ error: errorMessage(e) }, { status });
}
