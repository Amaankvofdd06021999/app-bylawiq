import type {Alert,LedgerEntry,ResidentDraft,Wallet} from '@/mock/store';
import {IDS} from './ids';
import {uid} from './uid';
import type {Clock} from './clock';
// Priya's paid resident account at Seaside Towers (demo only — no real payments). Her ledger adds up to her
// balance: one 100-credit purchase, two free questions, five paid questions, one notice draft, one letter reply.
const priya=IDS.users.priya,seaside=IDS.buildings.seaside;
const entry=(n:number,delta:number,reason:LedgerEntry['reason'],at:string):LedgerEntry=>({id:uid('33000000',n),userId:priya,buildingId:seaside,delta,reason,at});
export function residentSeed(c:Clock):{wallets:Wallet[];ledger:LedgerEntry[];residentDrafts:ResidentDraft[];alerts:Alert[]}{
const ledger:LedgerEntry[]=[
 entry(1,100,'purchase',c.ago(25,'18:10')),
 entry(2,0,'free_question',c.ago(25,'18:14')),
 entry(3,0,'free_question',c.ago(24,'08:02')),
 entry(4,-1,'question',c.ago(22,'20:31')),
 entry(5,-1,'question',c.ago(18,'07:45')),
 entry(6,-5,'draft_notice',c.ago(15,'19:20')),
 entry(7,-1,'question',c.ago(12,'21:03')),
 entry(8,-3,'letter_reply',c.ago(9,'17:40')),
 entry(9,-1,'question',c.ago(6,'09:12')),
 entry(10,-1,'question',c.ago(3,'22:05')),
];
// Quotes Seaside's seeded bylaw 3.1 (mock/data/documents.ts) word for word.
const quietHours='Quiet hours run from 10:00 pm to 7:00 am. Construction or renovation noise is not permitted before 9:00 am on weekends.';
const residentDrafts:ResidentDraft[]=[
 {id:uid('34000000',1),userId:priya,buildingId:seaside,kind:'notice_to_council',title:'Weekend renovation noise',
  body:`Dear council,\n\nI am writing about renovation noise from a nearby unit that started before 9:00 am on two recent Saturdays.\n\nBylaw 3.1 says: “${quietHours}”\n\nPlease remind the owner of the weekend start time and let me know how council will follow up.\n\nThank you,\nPriya Nair, unit 1204`,
  sources:[{id:1,chunkId:uid('34000001',1),kind:'building',title:'Registered bylaws · Consolidated 2025',content:quietHours,sectionRef:'3.1',effectiveDate:'2025-03-12',buildingId:seaside,page:null,citation:null}],
  created_at:c.ago(15,'19:20')},
];
// Bylaw-change alerts for Seaside, consistent with its seeded bylaw versions (mock/data/bylaws.ts).
const alerts:Alert[]=[
 {id:uid('35000000',1),buildingId:seaside,title:'Electric vehicle charging bylaw is being drafted',body:'Council is drafting a process for reviewing requests for electric vehicle charging. It is not in force yet, and owners will vote on it before it applies.',created_at:c.ago(38)},
 {id:uid('35000000',2),buildingId:seaside,title:'Consolidated bylaws registered',body:'The consolidated bylaws were filed with the Land Title Office and took effect on March 12, 2025. They include quiet hours, pets and visitor parking.',created_at:'2025-03-12T09:00:00Z'},
];
return {wallets:[{userId:priya,buildingId:seaside,credits:87,freeQuestionsUsed:2}],ledger,residentDrafts,alerts};
}
