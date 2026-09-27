import {describe,it,expect,vi,beforeAll} from 'vitest';
// Same in-memory cookie jar technique as tests/mock/personas.test.ts, so the demo pages can be run as a persona.
const jar=new Map<string,string>();
vi.mock('next/headers',()=>({cookies:async()=>({
 get:(name:string)=>jar.has(name)?{name,value:jar.get(name)!}:undefined,
 set:(name:string,value:string)=>{jar.set(name,value);},
 delete:(name:string)=>{jar.delete(name);},
})}));
vi.mock('next/cache',()=>({revalidatePath:()=>{}}));
const {seed}=await import('@/mock/store');
const {IDS}=await import('@/mock/data');
const {platformDashboard,firmOwnerDashboard,strataManagerDashboard,buildingManagerDashboard}=await import('@/mock/dashboards');
const {setFlag}=await import('@/mock/mutations');
const {startDemo}=await import('@/mock/session');
const {ForbiddenError,NotFoundError}=await import('@/lib/errors');
const u=IDS.users,b=IDS.buildings;
const NOW=new Date('2026-09-27T12:00:00Z');
beforeAll(()=>{process.env.DEMO_MODE='on';});
async function redirectOf(run:()=>Promise<unknown>):Promise<string>{
 try{await run();}catch(e){const digest=(e as {digest?:unknown}).digest;if(typeof digest==='string')return digest.split(';')[2];throw e;}
 throw new Error('expected a redirect');
}
describe('platform admin dashboard',()=>{
 it('sums revenue, usage and knowledge health from the seed',()=>{
  const d=platformDashboard(seed(),u.alex,NOW);
  expect(d.revenue.mrr).toBeCloseTo(198.5);
  expect(d.revenue.launchMrr).toBeCloseTo(99.5);
  expect(d.revenue.launchCustomers).toBe(1);
  expect(d.revenue.listMrr).toBe(298);
  expect(d.revenue.creditSales).toBe(20);
  expect(d.revenue.payingCustomers).toBe(2);
  expect(d.revenue.trials).toBe(1);
  expect(d.usage.questions).toBe(446);
  expect(d.usage.estCostUsd).toBeCloseTo(38.2);
  expect(d.usage.noGroundingRate).toBeCloseTo(23/446);
  expect(d.usage.top[0]).toMatchObject({buildingId:b.seaside,name:'Seaside Towers',questions:214});
  expect(d.knowledge).toMatchObject({failed:0,processing:0,awaitingReview:4,bylawsUnconfirmed:0,legalPassages:10,legalUpdatedAt:'2026-09-01T09:00:00Z'});
  expect(d.flags.residentAi).toBe(true);
 });
 it('counts seats per customer',()=>{
  const d=platformDashboard(seed(),u.alex,NOW);
  const seats=Object.fromEntries(d.customers.map(c=>[c.name,[c.seatsUsed,c.seatsIncluded]]));
  expect(seats['Coastline Strata Management']).toEqual([3,5]);
  expect(seats['Seaside Towers']).toEqual([3,3]);
  expect(seats['Parkside']).toEqual([1,3]);
  expect(d.customers.find(c=>c.name==='Harbour View')?.billedTo).toBe('Coastline Strata Management');
 });
 it('carries no building document content',()=>{
  const s=seed();const text=JSON.stringify(platformDashboard(s,u.alex,NOW));
  for(const c of s.chunks)expect(text).not.toContain(c.content);
  for(const d of s.documents)expect(text).not.toContain(String(d.title));
 });
 it('is only for the platform admin',()=>{
  const s=seed();
  for(const user of [u.dana,u.sarah,u.james,u.priya])expect(()=>platformDashboard(s,user,NOW)).toThrow(ForbiddenError);
 });
 it('lets only the platform admin turn resident AI off and on, with an audit entry',()=>{
  const s=seed();
  expect(setFlag(s,u.dana,{flag:'residentAi',enabled:false})).toEqual({ok:false,error:expect.any(String)});
  expect(s.platform.flags.residentAi).toBe(true);
  const before=s.platform.audit.length;
  expect(setFlag(s,u.alex,{flag:'residentAi',enabled:false})).toEqual({ok:true});
  expect(s.platform.flags.residentAi).toBe(false);
  expect(s.platform.audit).toHaveLength(before+1);
  expect(platformDashboard(s,u.alex,NOW).flags.residentAi).toBe(false);
  expect(setFlag(s,u.alex,{flag:'other',enabled:true}).ok).toBe(false);
 });
});
describe('firm owner dashboard',()=>{
 it('lists Coastline’s staff with their buildings, open reviews and last activity',()=>{
  const d=firmOwnerDashboard(seed(),u.dana,NOW);
  expect(d.firm.name).toBe('Coastline Strata Management');
  expect(d.staff.map(x=>[x.name,x.role,x.buildings,x.openReviews])).toEqual([
   ['Dana Ruiz','Organization owner',3,2],['Sarah Chen','Portfolio manager',3,2],['Lee Wong','Assistant manager',3,0]]);
  expect(d.staff.find(x=>x.name==='Sarah Chen')?.lastActive).toBe('2026-09-22T09:00:00Z');
  expect(d.staff.find(x=>x.name==='Lee Wong')?.lastActive).toBeNull();
  expect(d.staff[0].you).toBe(true);
 });
 it('shows the roster, review turnaround, knowledge, plan and invitations',()=>{
  const d=firmOwnerDashboard(seed(),u.dana,NOW);
  expect(d.roster.map(r=>[r.name,r.pendingReviews,r.openDisputes])).toEqual([['Harbour View',1,0],['Marina Court',0,0],['Seaside Towers',1,2]]);
  expect(d.roster.find(r=>r.name==='Marina Court')?.health.tone).toBe('warning');// insurance summary awaiting review
  expect(d.turnaround).toMatchObject({medianHours:60,decided:2,waiting:2});
  expect(d.turnaround.oldest).toMatchObject({title:'Noise contravention · Unit 812',days:7});
  expect(d.knowledge.total).toBe(8);
  expect(d.knowledge.collections.map(c=>c.count)).toEqual([2,2,2,2]);
  expect(d.plan).toMatchObject({label:'Strata Manager',listPrice:199,price:99.5,seatsIncluded:5,seatsUsed:3,buildings:3});
  expect(d.invitations.map(i=>i.email)).toEqual(['noor.aziz@example.com']);
 });
 it('is only for firm staff',()=>{
  const s=seed();
  for(const user of [u.alex,u.james,u.priya])expect(()=>firmOwnerDashboard(s,user,NOW)).toThrow(ForbiddenError);
 });
});
describe('strata manager dashboard',()=>{
 it('puts what needs Sarah today first: deadlines, reviews, unsent notices and law changes',()=>{
  const d=strataManagerDashboard(seed(),u.sarah,NOW);
  expect(d.needsAttention.map(i=>[i.kind,i.title])).toEqual([
   ['deadline','Noise contravention · Unit 812'],
   ['review','Noise contravention · Unit 812'],
   ['review','Harbour View council report · Q3'],
   ['unsent','Move-in fee · Reminder to Unit 1204'],
   ['law','Legislation tracker: fines and the s.135 process'],
  ]);
  expect(d.needsAttention[0]).toMatchObject({buildingId:b.seaside,section:'disputes'});
 });
 it('summarises each building and offers firm knowledge and asking across buildings',()=>{
  const d=strataManagerDashboard(seed(),u.sarah,NOW);
  expect(d.buildings.map(x=>x.name)).toEqual(['Harbour View','Marina Court','Seaside Towers']);
  expect(d.buildings.find(x=>x.name==='Seaside Towers')).toMatchObject({reviews:1,disputes:2,drafts:4,updates:2});
  expect(d.knowledge?.collections).toHaveLength(4);
  expect(d.askAcross?.count).toBe(3);
 });
 it('drops deadlines more than 14 days away',()=>{
  const d=strataManagerDashboard(seed(),u.sarah,new Date('2026-09-01T12:00:00Z'));
  expect(d.needsAttention.some(i=>i.kind==='deadline')).toBe(false);
 });
});
describe('building manager dashboard',()=>{
 it('shows James his building, drafts, council tasks, residents and seats',()=>{
  const d=buildingManagerDashboard(seed(),u.james,b.seaside,NOW);
  expect(d.building.name).toBe('Seaside Towers');
  expect(d.plan).toMatchObject({label:'Building',price:99,seatsIncluded:3,seatsUsed:3});
  expect(d.residents.count).toBe(1);
  expect(d.firmName).toBe('Coastline Strata Management');
  expect(d.drafts.map(x=>x.status).sort()).toEqual(['approved','changes_requested','draft','pending_review']);
  expect(d.drafts.find(x=>x.status==='changes_requested')?.note).toContain('cite the specific bylaw section');
  expect(d.council.updates).toHaveLength(2);
  expect(d.council.disputes.map(x=>x.stage)).toEqual(['warning_sent','reported']);
  expect(d.can).toEqual({draft:true,ask:true,upload:true,invite:true});
 });
 it('never includes firm knowledge and refuses other buildings',()=>{
  const s=seed();const text=JSON.stringify(buildingManagerDashboard(s,u.james,b.seaside,NOW));
  for(const f of s.firmDocs)expect(text).not.toContain(f.title);
  expect(()=>buildingManagerDashboard(s,u.james,b.harbour,NOW)).toThrow(NotFoundError);
  expect(()=>buildingManagerDashboard(s,u.alex,b.seaside,NOW)).toThrow(NotFoundError);
 });
});
describe('demo pages for the platform admin',()=>{
 it('sends the platform admin away from building pages and the workspace to /demo/admin',async()=>{
  await startDemo('platform');
  const {default:BuildingPage}=await import('@/app/demo/b/[buildingId]/[section]/page');
  const {default:WorkspacePage}=await import('@/app/demo/workspace/page');
  expect(await redirectOf(()=>BuildingPage({params:Promise.resolve({buildingId:b.seaside,section:'home'}),searchParams:Promise.resolve({})}))).toBe('/demo/admin');
  expect(await redirectOf(()=>BuildingPage({params:Promise.resolve({buildingId:b.seaside,section:'documents'}),searchParams:Promise.resolve({})}))).toBe('/demo/admin');
  expect(await redirectOf(()=>WorkspacePage({searchParams:Promise.resolve({})}))).toBe('/demo/admin');
 });
 it('sends everyone else away from /demo/admin to their own home',async()=>{
  const {default:AdminPage}=await import('@/app/demo/admin/page');
  await startDemo('owner');
  expect(await redirectOf(()=>AdminPage())).toBe('/demo/workspace');
  await startDemo('building');
  expect(await redirectOf(()=>AdminPage())).toBe(`/demo/b/${b.seaside}/home`);
 });
 it('falls back to documents for a resident’s home until the resident home exists',async()=>{
  await startDemo('resident');
  const {default:BuildingPage}=await import('@/app/demo/b/[buildingId]/[section]/page');
  expect(await redirectOf(()=>BuildingPage({params:Promise.resolve({buildingId:b.seaside,section:'home'}),searchParams:Promise.resolve({})}))).toBe(`/demo/b/${b.seaside}/documents`);
 });
});
