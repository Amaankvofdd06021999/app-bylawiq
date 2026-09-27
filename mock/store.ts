import type {Building,Profile,Row} from '@/lib/schema';
// `mock/data/index.ts` only needs the `MockState` type below (a type-only import, erased at compile time),
// so importing its `SEED` value here is not a runtime cycle.
import {SEED} from './data';
export type MockState={profiles:Profile[];organizations:Row[];orgMembers:Row[];buildings:Building[];members:Row[];firmLinks:Row[];linkCodes:Row[];documents:Row[];chunks:{documentId:string;buildingId:string;sectionRef:string|null;content:string}[];knowledge:Row[];agents:Row[];deployments:Row[];bylaws:Row[];versions:Row[];notices:Row[];comments:Row[];disputes:Row[];events:Row[];updates:Row[];invitations:Row[];audit:Row[];chats:Row[];messages:{id:string;chatId:string;role:'user'|'assistant';parts:unknown[]}[]};
// Per-session, in-memory store. Each session gets its own deep clone of the seed so one demo persona's
// changes never leak into another session's copy of the same buildings — the in-memory analogue of the
// RLS boundary the real app enforces in Postgres (see AGENTS.md §0).
const sessions=new Map<string,MockState>();
export function seed():MockState{return structuredClone(SEED);}
export function getStore(sessionId:string):MockState{
 let state=sessions.get(sessionId);
 if(!state){state=seed();sessions.set(sessionId,state);}
 return state;
}
export function resetStore(sessionId:string):void{sessions.set(sessionId,seed());}
export function newId():string{return crypto.randomUUID();}
export function audit(s:MockState,actorId:string,buildingId:string|null,action:string,targetId:string|null):void{
 s.audit.push({id:newId(),building_id:buildingId??undefined,action,target_id:targetId,actor_id:actorId,occurred_at:new Date().toISOString()});
}
