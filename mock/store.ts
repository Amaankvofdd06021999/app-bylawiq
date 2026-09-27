import type {Building,Profile,Row} from '@/lib/schema';
// `mock/data/index.ts` only needs the `MockState` type below (a type-only import, erased at compile time),
// so importing its `buildSeed` value here is not a runtime cycle.
import {buildSeed} from './data';
export type MockState={profiles:Profile[];organizations:Row[];orgMembers:Row[];buildings:Building[];members:Row[];firmLinks:Row[];linkCodes:Row[];documents:Row[];chunks:{documentId:string;buildingId:string;sectionRef:string|null;content:string}[];knowledge:Row[];agents:Row[];deployments:Row[];bylaws:Row[];versions:Row[];notices:Row[];comments:Row[];disputes:Row[];events:Row[];updates:Row[];invitations:Row[];audit:Row[];chats:Row[];messages:{id:string;chatId:string;role:'user'|'assistant';parts:unknown[]}[];
 firmDocs:FirmDoc[];firmChunks:FirmChunk[];legalChunks:LegalChunk[];wallets:Wallet[];ledger:LedgerEntry[];residentDrafts:ResidentDraft[];alerts:Alert[];platform:PlatformState};
// Demo v2 knowledge layers (see mock/rules.ts#layersFor): `firm` is a firm's internal knowledge, `legal` the
// shared Act/Regulation/CRT corpus. Neither has a real table yet; these are the shapes the demo stores.
export type Layer='building'|'firm'|'legal';
export type FirmCollection='templates'|'policies'|'guidance'|'legal_tracker';
export type FirmDoc={id:string;orgId:string;collection:FirmCollection;title:string;body:string;updated_at:string;created_by:string};
export type FirmChunk={docId:string;orgId:string;sectionRef:string;content:string};
export type LegalChunk={id:string;source:'act'|'regulation'|'crt';title:string;citation:string;sectionRef:string;content:string;updated_at:string};
// Resident credits (demo only): `freeQuestionsUsed` counts the first free questions; drafting never uses them.
export type Wallet={userId:string;buildingId:string;credits:number;freeQuestionsUsed:number};
export type LedgerReason='purchase'|'question'|'draft_notice'|'letter_reply'|'free_question';
export type LedgerEntry={id:string;userId:string;buildingId:string;delta:number;reason:LedgerReason;at:string};
export type ResidentDraft={id:string;userId:string;buildingId:string;kind:'notice_to_council'|'letter_reply';title:string;body:string;sources:unknown[];meaning?:string[];created_at:string};
export type Alert={id:string;buildingId:string;title:string;body:string;created_at:string};
// Platform-wide aggregates for the BylawIQ admin. `admins` is the mock stand-in for the `platform_admin` JWT
// claim (profiles.account_type can't tell a platform admin from a firm owner — both are 'admin').
export type PlatformState={plans:Row[];usage:Row[];flags:{residentAi:boolean};audit:Row[];admins:string[]};
// Per-session, in-memory store. Each session gets its own deep clone of the seed so one demo persona's
// changes never leak into another session's copy of the same buildings — the in-memory analogue of the
// RLS boundary the real app enforces in Postgres (see AGENTS.md §0).
// Kept on `globalThis` so pages, server actions and route handlers — which Next.js may bundle as separate
// module instances — all see the same sessions, and dev hot reloads don't wipe them. Bounded: beyond
// MAX_SESSIONS the least recently used session is dropped (its person simply starts again from the seed).
export const MAX_SESSIONS=500;
const g=globalThis as typeof globalThis&{__bylawiqDemoSessions?:Map<string,MockState>};
const sessions=g.__bylawiqDemoSessions??=new Map<string,MockState>();
/** A fresh demo state, dated relative to `now` (see mock/data/clock.ts). */
export function seed(now=new Date()):MockState{return structuredClone(buildSeed(now));}
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
