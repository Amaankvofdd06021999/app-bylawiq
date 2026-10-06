import { ZodError } from 'zod';
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
  constructor() {
    super('unauthorized', 'Please sign in to continue.', 401);
  }
}
export class ForbiddenError extends AppError {
  constructor() {
    super('forbidden', 'You do not have permission for this action.', 403);
  }
}
export class NotFoundError extends AppError {
  constructor() {
    super('not_found', 'This item is unavailable.', 404);
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
    review_required: 'Choose a legal review option first.',
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
  };
  for (const [key, message] of Object.entries(safe))
    if (error.message.includes(key)) throw new AppError(key, message, 409);
  if (error.code === '42501' || error.message.includes('forbidden')) throw new ForbiddenError();
  if (error.code === '23505')
    throw new AppError('conflict', 'This item already exists, or a request is already running.', 409);
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
  return Response.json(
    { error: errorMessage(e) },
    { status: e instanceof AppError ? e.status : e instanceof ZodError ? 400 : 500 },
  );
}
