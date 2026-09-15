import {ZodError} from 'zod';
export class AppError extends Error { constructor(public code:string, message:string, public status=400){super(message);} }
export class UnauthorizedError extends AppError {constructor(){super('unauthorized','Please sign in to continue.',401);}}
export class ForbiddenError extends AppError {constructor(){super('forbidden','You do not have permission for this action.',403);}}
export class NotFoundError extends AppError {constructor(){super('not_found','This item is unavailable.',404);}}
export class RateLimitError extends AppError {constructor(){super('rate_limited','Too many requests. Please try again in a minute.',429);}}
export function checkDb(error:{code?:string;message:string}|null){if(!error)return;
 const safe:Record<string,string>={single_building_conflict:'This email already belongs to another single-building account. Use a separate plus-addressed email, or have the administrator provision a portfolio account.',single_building_bound:'This account is permanently assigned to one building.',self_approval_not_permitted:'Another authorized reviewer must approve this notice.',knowledge_not_ready:'Add and finish indexing a knowledge source before deploying.',legal_review_required:'Arrange legal review or record a specific justification before proposing.',invalid_transition:'This action is not available at the current stage.',review_required:'Choose a legal review option first.',already_configured:'This account is already configured.'};
 for(const [key,message] of Object.entries(safe))if(error.message.includes(key))throw new AppError(key,message,409);
 if(error.code==='42501'||error.message.includes('forbidden'))throw new ForbiddenError();
 if(error.code==='23505')throw new AppError('conflict','This item already exists, or a request is already running.',409);
 throw new AppError('database_error','The change could not be saved. Please try again.',500);
}
export function errorMessage(e:unknown){return e instanceof AppError?e.message:e instanceof ZodError?'Check the highlighted fields and try again.':'Something went wrong. Please try again.';}
export function errorResponse(e:unknown){return Response.json({error:errorMessage(e)},{status:e instanceof AppError?e.status:e instanceof ZodError?400:500});}
