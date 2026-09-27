import 'server-only';
import {cookies} from 'next/headers';
import {demoEnabled} from '@/lib/env';
import {persona,type Persona,type PersonaId} from './personas';
import {newId} from './store';
const SESSION_COOKIE='demo_session';
const PERSONA_COOKIE='demo_persona';
export async function demoSession():Promise<{sessionId:string;persona:Persona}|null>{
 // With the demo off there is no demo session, whatever cookies arrive, so no mock action or read can run.
 if(!demoEnabled())return null;
 const jar=await cookies();
 const sessionId=jar.get(SESSION_COOKIE)?.value;
 const personaId=jar.get(PERSONA_COOKIE)?.value;
 if(!sessionId||!personaId)return null;
 const p=persona(personaId);
 return p?{sessionId,persona:p}:null;
}
export async function startDemo(id:PersonaId):Promise<void>{
 if(!demoEnabled())return;
 const jar=await cookies();
 const sessionId=newId();
 const options={httpOnly:true,sameSite:'lax' as const,path:'/'};
 jar.set(SESSION_COOKIE,sessionId,options);
 jar.set(PERSONA_COOKIE,id,options);
}
export async function endDemo():Promise<void>{
 const jar=await cookies();
 jar.delete(SESSION_COOKIE);
 jar.delete(PERSONA_COOKIE);
}
