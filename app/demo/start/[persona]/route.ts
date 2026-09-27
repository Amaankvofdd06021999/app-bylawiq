import {redirect} from 'next/navigation';
import {demoEnabled} from '@/lib/env';
import {persona,landingPath} from '@/mock/personas';
import {startDemo} from '@/mock/session';
import {seed} from '@/mock/store';
export const dynamic='force-dynamic';
// Starts a fresh demo session as the chosen person, then lands them where their role begins. A new session starts
// from the seed, so the landing page is worked out against the seed.
export async function GET(_req:Request,{params}:{params:Promise<{persona:string}>}){
 if(!demoEnabled())return new Response(null,{status:404});
 const p=persona((await params).persona);
 if(!p)return new Response(null,{status:404});
 await startDemo(p.id);
 redirect(landingPath(p,seed()));
}
