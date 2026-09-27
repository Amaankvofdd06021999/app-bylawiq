import {redirect} from 'next/navigation';
import {demoEnabled} from '@/lib/env';
import {persona,landingPath} from '@/mock/personas';
import {startDemo} from '@/mock/session';
import {getStore} from '@/mock/store';
export const dynamic='force-dynamic';
// Starts this browser's first demo session, or switches persona within its existing one (see
// mock/session.ts#startDemo: only a first visit, or a session started fresh after sign-out, gets a new,
// freshly seeded store), then lands the person where their role begins. Either way the landing page is
// worked out against that session's current store, not a bare seed, so it reflects whatever's already
// happened in it.
export async function GET(_req:Request,{params}:{params:Promise<{persona:string}>}){
 if(!demoEnabled())return new Response(null,{status:404});
 const p=persona((await params).persona);
 if(!p)return new Response(null,{status:404});
 const sessionId=await startDemo(p.id);
 redirect(landingPath(p,getStore(sessionId!)));
}
