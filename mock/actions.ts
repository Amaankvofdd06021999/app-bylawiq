'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {demoSession,endDemo,startDemo} from './session';
import {getStore,resetStore,type MockState} from './store';
import {persona} from './personas';
import {demoEnabled} from '@/lib/env';
import * as pure from './mutations';
// Demo stand-ins for the real server actions: same names, signatures and result shapes. Each one resolves the
// demo session, runs the pure mutation against that session's own store as the persona's user, and refreshes
// the demo pages. The persona comes from the session cookie, never from the caller's input.
type Failure={ok:false;error:string};
async function withSession<T>(fn:(s:MockState,userId:string)=>T):Promise<T|Failure>{
 const session=await demoSession();
 if(!session)return {ok:false,error:'Please sign in to continue.'};
 const result=fn(getStore(session.sessionId),session.persona.userId);
 revalidatePath('/demo','layout');
 return result;
}
export async function mutateAction(raw:unknown){return withSession((s,u)=>pure.mutate(s,u,raw));}
export async function createFirmCodeAction(raw:unknown){return withSession((s,u)=>pure.createFirmCode(s,u,raw));}
export async function revokeFirmLinkAction(raw:unknown){return withSession((s,u)=>pure.revokeFirmLink(s,u,raw));}
export async function acceptFirmCodeAction(raw:unknown){return withSession((s,u)=>pure.acceptFirmCode(s,u,raw));}
export async function createChatAction(raw:unknown){return withSession((s,u)=>pure.createChat(s,u,raw));}
export async function branchChatAction(raw:unknown){return withSession((s,u)=>pure.branchChat(s,u,raw));}
export async function setResidentAiAction(raw:unknown){return withSession((s,u)=>pure.setFlag(s,u,raw));}
export async function signOutAction():Promise<void>{if(!demoEnabled())return;await endDemo();redirect('/demo');}
export async function resetDemoAction():Promise<void>{
 if(!demoEnabled())return;
 const session=await demoSession();
 if(session)resetStore(session.sessionId);
 revalidatePath('/demo','layout');
}
export async function switchPersonaAction(id:string):Promise<void>{
 if(!demoEnabled())return;
 const p=persona(id);
 if(!p)return;
 await startDemo(p.id);
 revalidatePath('/demo','layout');
}
