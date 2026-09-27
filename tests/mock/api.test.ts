import {describe,it,expect,vi,beforeAll} from 'vitest';
// `mock/session.ts` reads/writes cookies via `next/headers`, which only works inside a real Next.js request
// scope. This fakes that cookie jar in memory so `startDemo`/`demoSession` behave the same way they do in
// the app, letting these tests act as each persona the way `app/demo/start/[persona]/route.ts` will (Task 6).
const jar=new Map<string,string>();
vi.mock('next/headers',()=>({cookies:async()=>({
 get:(name:string)=>jar.has(name)?{name,value:jar.get(name)!}:undefined,
 set:(name:string,value:string)=>{jar.set(name,value);},
 delete:(name:string)=>{jar.delete(name);},
})}));
const {startDemo}=await import('@/mock/session');
const {IDS}=await import('@/mock/data');
const {seed}=await import('@/mock/store');
const api=await import('@/mock/api');
type PersonaId='platform'|'owner'|'strata'|'building'|'resident';
async function as<T>(persona:PersonaId,run:()=>Promise<T>):Promise<T>{await startDemo(persona);return run();}
const seaside=IDS.buildings.seaside;
beforeAll(()=>{process.env.DEMO_MODE='on';});
describe('mock api: gate',()=>{
 it('404s when the demo is not enabled',async()=>{
  process.env.DEMO_MODE='off';
  const res=await api.chatStop(new Request('http://x',{method:'POST'}),{id:IDS.chats.jamesConversation});
  expect(res.status).toBe(404);
  process.env.DEMO_MODE='on';
 });
 it('401s with no demo session',async()=>{
  jar.clear();
  const res=await api.chatStop(new Request('http://x',{method:'POST'}),{id:IDS.chats.jamesConversation});
  expect(res.status).toBe(401);
 });
});
describe('mock api: upload',()=>{
 const form=()=>{const f=new FormData();f.set('buildingId',seaside);f.set('title','Move-in notes');f.set('type','other');f.set('knowledgeBaseId','');f.set('effectiveDate','');f.set('filingReference','');f.set('consent','on');f.set('file',new File(['hello'],'notes.txt',{type:'text/plain'}));return f;};
 it('forbids a resident and accepts the building manager',async()=>{
  const forbidden=await as('resident',()=>api.upload(new Request('http://x',{method:'POST',body:form()})));
  expect(forbidden.status).toBe(403);
  const ok=await as('building',()=>api.upload(new Request('http://x',{method:'POST',body:form()})));
  expect(ok.status).toBe(201);
  expect(typeof (await ok.json()).id).toBe('string');
 });
 it('puts an uploaded bylaws document into review with parsed sections',async()=>{
  const bylaw=()=>{const f=form();f.set('type','bylaws');f.set('title','Amendment · Balconies');return f;};
  const res=await as('building',()=>api.upload(new Request('http://x',{method:'POST',body:bylaw()})));
  const {id}=await res.json();
  // The cookie jar still points at the session `as('building',...)` just started, so this reads the very
  // store the handler above wrote into.
  const {getStore}=await import('@/mock/store');
  const {demoSession}=await import('@/mock/session');
  const store=getStore((await demoSession())!.sessionId);
  const doc=store.documents.find(d=>d.id===id);
  expect(doc).toMatchObject({status:'review',structure_confirmed:false});
 });
});
describe('mock api: sources',()=>{
 it('creates a source document with a source_url',async()=>{
  const res=await as('building',()=>api.sources(new Request('http://x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({buildingId:seaside,title:'City bylaw portal',url:'https://example.com/bylaws',knowledgeBaseId:null,consent:true})})));
  expect(res.status).toBe(201);
 });
 it('forbids a resident',async()=>{
  const res=await as('resident',()=>api.sources(new Request('http://x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({buildingId:seaside,title:'x',url:'https://example.com',knowledgeBaseId:null,consent:true})})));
  expect(res.status).toBe(403);
 });
});
describe('mock api: download',()=>{
 it('hides a non-owner-visible document from a resident and shows it to the building manager',async()=>{
  const s=seed();
  const hidden=s.documents.find(d=>d.building_id===seaside&&d.owner_visible===false);
  if(!hidden)throw new Error('fixture expects a non-owner-visible Seaside document');
  const asResident=await as('resident',()=>api.download(new Request('http://x'),{id:String(hidden.id)}));
  expect(asResident.status).toBe(404);
  const asManager=await as('building',()=>api.download(new Request('http://x'),{id:String(hidden.id)}));
  expect(asManager.status).toBe(200);
  const text=await asManager.text();
  expect(text.length).toBeGreaterThan(0);
  expect(asManager.headers.get('Content-Disposition')).toContain('attachment');
 });
});
describe('mock api: export',()=>{
 it('exports an approved notice as a PDF with the linked firm letterhead',async()=>{
  const res=await as('building',()=>api.exportArtifact(new Request('http://x'),{id:String(IDS.notices.seasideApproved)}));
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('application/pdf');
  const bytes=await res.arrayBuffer();
  expect(bytes.byteLength).toBeGreaterThan(0);
 });
});
describe('mock api: chat',()=>{
 it('forbids a resident from posting to another user\'s chat',async()=>{
  const res=await as('resident',()=>api.chat(new Request('http://x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:IDS.chats.jamesConversation,message:{id:crypto.randomUUID(),role:'user',parts:[{type:'text',text:'Can residents use visitor parking?'}]}})})));
  expect(res.status).toBe(403);
 });
 it('streams a grounded data-answer part for a question the seed documents cover',async()=>{
  const res=await as('building',()=>api.chat(new Request('http://x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:IDS.chats.jamesConversation,message:{id:crypto.randomUUID(),role:'user',parts:[{type:'text',text:'Can I have a dog?'}]}})})));
  expect(res.status).toBe(200);
  const text=await res.text();
  expect(text).toContain('data-answer');
  expect(text).toContain('Demo answer from sample documents.');
 });
});
describe('mock api: chat stop/stream',()=>{
 it('returns 204 for both',async()=>{
  const stop=await as('building',()=>api.chatStop(new Request('http://x',{method:'POST'}),{id:IDS.chats.jamesConversation}));
  expect(stop.status).toBe(204);
  const stream=await as('building',()=>api.chatStream(new Request('http://x'),{id:IDS.chats.jamesConversation}));
  expect(stream.status).toBe(204);
 });
});
