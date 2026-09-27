import type {Building,Profile,Row} from '@/lib/schema';
// `mock/data/index.ts` only needs the `MockState` type below (a type-only import, erased at compile time),
// so importing its `SEED` value here is not a runtime cycle.
import {SEED} from './data';
export type MockState={profiles:Profile[];organizations:Row[];orgMembers:Row[];buildings:Building[];members:Row[];firmLinks:Row[];linkCodes:Row[];documents:Row[];chunks:{documentId:string;buildingId:string;sectionRef:string|null;content:string}[];knowledge:Row[];agents:Row[];deployments:Row[];bylaws:Row[];versions:Row[];notices:Row[];comments:Row[];disputes:Row[];events:Row[];updates:Row[];invitations:Row[];audit:Row[];chats:Row[];messages:{id:string;chatId:string;role:'user'|'assistant';parts:unknown[]}[]};
// Per-session, in-memory store. Each session gets its own deep clone of the seed so one demo persona's
// changes never leak into another session's copy of the same buildings — the in-memory analogue of the
// RLS boundary the real app enforces in Postgres (see AGENTS.md §0).
// Kept on `globalThis` so pages, server actions and route handlers — which Next.js may bundle as separate
// module instances — all see the same sessions, and dev hot reloads don't wipe them. Bounded: beyond
// MAX_SESSIONS the least recently used session is dropped (its person simply starts again from the seed).
export const MAX_SESSIONS=500;
const g=globalThis as typeof globalThis&{__bylawiqDemoSessions?:Map<string,MockState>};
const sessions=g.__bylawiqDemoSessions??=new Map<string,MockState>();
export function seed():MockState{return structuredClone(SEED);}
function put(sessionId:string,state:MockState):MockState{
 sessions.delete(sessionId);sessions.set(sessionId,state);// Map order is insertion order, so the end is most recent
 while(sessions.size>MAX_SESSIONS){const oldest=sessions.keys().next().value;if(oldest===undefined)break;sessions.delete(oldest);}
 return state;
}
export function getStore(sessionId:string):MockState{return put(sessionId,sessions.get(sessionId)??seed());}
export function hasStore(sessionId:string):boolean{return sessions.has(sessionId);}
export function resetStore(sessionId:string):void{put(sessionId,seed());}
export function newId():string{return crypto.randomUUID();}
export function audit(s:MockState,actorId:string,buildingId:string|null,action:string,targetId:string|null):void{
 s.audit.push({id:newId(),building_id:buildingId??undefined,action,target_id:targetId,actor_id:actorId,occurred_at:new Date().toISOString()});
}
