import type {Alert,LedgerEntry,ResidentDraft,Wallet} from '@/mock/store';
import {IDS} from './ids';
import {uid} from './uid';
// Priya's paid resident account at Seaside Towers (demo only — no real payments). Her ledger adds up to her
// balance: one 100-credit purchase, two free questions, five paid questions, one notice draft, one letter reply.
const priya=IDS.users.priya,seaside=IDS.buildings.seaside;
export const wallets:Wallet[]=[{userId:priya,buildingId:seaside,credits:87,freeQuestionsUsed:2}];
const entry=(n:number,delta:number,reason:LedgerEntry['reason'],at:string):LedgerEntry=>({id:uid('33000000',n),userId:priya,buildingId:seaside,delta,reason,at});
export const ledger:LedgerEntry[]=[
 entry(1,100,'purchase','2026-09-02T18:10:00Z'),
 entry(2,0,'free_question','2026-09-02T18:14:00Z'),
 entry(3,0,'free_question','2026-09-03T08:02:00Z'),
 entry(4,-1,'question','2026-09-05T20:31:00Z'),
 entry(5,-1,'question','2026-09-09T07:45:00Z'),
 entry(6,-5,'draft_notice','2026-09-12T19:20:00Z'),
 entry(7,-1,'question','2026-09-15T21:03:00Z'),
 entry(8,-3,'letter_reply','2026-09-18T17:40:00Z'),
 entry(9,-1,'question','2026-09-21T09:12:00Z'),
 entry(10,-1,'question','2026-09-24T22:05:00Z'),
];
// Quotes Seaside's seeded bylaw 3.1 (mock/data/documents.ts) word for word.
const quietHours='Quiet hours run from 10:00 pm to 7:00 am. Construction or renovation noise is not permitted before 9:00 am on weekends.';
export const residentDrafts:ResidentDraft[]=[
 {id:uid('34000000',1),userId:priya,buildingId:seaside,kind:'notice_to_council',title:'Weekend renovation noise',
  body:`Dear council,\n\nI am writing about renovation noise from a nearby unit that started before 9:00 am on two recent Saturdays.\n\nBylaw 3.1 says: “${quietHours}”\n\nPlease remind the owner of the weekend start time and let me know how council will follow up.\n\nThank you,\nPriya Nair, unit 1204`,
  sources:[{id:1,chunkId:uid('34000001',1),kind:'building',title:'Registered bylaws · Consolidated 2025',content:quietHours,sectionRef:'3.1',effectiveDate:'2025-03-12',buildingId:seaside,page:null,citation:null}],
  created_at:'2026-09-12T19:20:00Z'},
];
// Bylaw-change alerts for Seaside, consistent with its seeded bylaw versions (mock/data/bylaws.ts).
export const alerts:Alert[]=[
 {id:uid('35000000',1),buildingId:seaside,title:'Electric vehicle charging bylaw is being drafted',body:'Council is drafting a process for reviewing requests for electric vehicle charging. It is not in force yet, and owners will vote on it before it applies.',created_at:'2026-08-20T09:00:00Z'},
 {id:uid('35000000',2),buildingId:seaside,title:'Consolidated bylaws registered',body:'The consolidated bylaws were filed with the Land Title Office and took effect on March 12, 2025. They include quiet hours, pets and visitor parking.',created_at:'2025-03-12T09:00:00Z'},
];
