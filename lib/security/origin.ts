import 'server-only';
import {ForbiddenError} from '@/lib/errors';
export function sameOrigin(req:Request){const origin=req.headers.get('origin');const expected=new URL(process.env.NEXT_PUBLIC_APP_URL||req.url).origin;if(!origin||origin!==expected)throw new ForbiddenError();}
