import {describe,it,expect,vi,beforeAll} from 'vitest';
// Same in-memory cookie jar technique as tests/mock/api.test.ts and tests/mock/gate.test.ts: `mock/session.ts`
// reads/writes cookies via `next/headers`, which only works inside a real Next.js request scope.
const jar=new Map<string,string>();
vi.mock('next/headers',()=>({cookies:async()=>({
 get:(name:string)=>jar.has(name)?{name,value:jar.get(name)!}:undefined,
 set:(name:string,value:string)=>{jar.set(name,value);},
 delete:(name:string)=>{jar.delete(name);},
})}));
const {startDemo,endDemo}=await import('@/mock/session');
const {getStore}=await import('@/mock/store');
const {IDS}=await import('@/mock/data');
const {mutate}=await import('@/mock/mutations');
const {firmReviewInbox}=await import('@/mock/source');
beforeAll(()=>{process.env.DEMO_MODE='on';});
describe('mock session: switching persona keeps the demo session',()=>{
 it('reuses the same session id when switching persona, and only mints a new one once the session ends',async()=>{
  jar.clear();
  const first=await startDemo('building');
  expect(first).toBeTruthy();
  const second=await startDemo('strata');
  expect(second).toBe(first);// still the same session, just a different person looking at it
  const third=await startDemo('resident');
  expect(third).toBe(first);
  await endDemo();
  const fourth=await startDemo('building');
  expect(fourth).not.toBe(first);// endDemo (sign out) is the other way a session ends, besides Reset demo
 });
 it('a change James makes is visible to Sarah once she switches into the same session',async()=>{
  jar.clear();
  const sessionId=(await startDemo('building'))!;
  const seaside=IDS.buildings.seaside;
  expect(firmReviewInbox(getStore(sessionId),IDS.users.sarah).some(n=>n.id===IDS.notices.seasideDraft)).toBe(false);// still just a draft
  // James sends the seeded Seaside draft to strata management for review.
  const sent=mutate(getStore(sessionId),IDS.users.james,{buildingId:seaside,operation:'notice.firm_review',id:IDS.notices.seasideDraft,values:{confirmed:true}});
  expect(sent.ok).toBe(true);
  // Switching to Sarah keeps the same session id — the fix under test — so `getStore` for her session
  // returns the very store James just wrote into, and her review inbox shows the draft he sent.
  const afterSwitch=await startDemo('strata');
  expect(afterSwitch).toBe(sessionId);
  expect(firmReviewInbox(getStore(afterSwitch!),IDS.users.sarah).some(n=>n.id===IDS.notices.seasideDraft)).toBe(true);
 });
});
