import {describe,it,expect,vi,beforeAll,afterAll} from 'vitest';
// Same in-memory cookie jar technique as tests/mock/session.test.ts.
const jar=new Map<string,string>();
vi.mock('next/headers',()=>({cookies:async()=>({
 get:(name:string)=>jar.has(name)?{name,value:jar.get(name)!}:undefined,
 set:(name:string,value:string)=>{jar.set(name,value);},
 delete:(name:string)=>{jar.delete(name);},
})}));
const {PERSONAS,persona,landingPath}=await import('@/mock/personas');
const {seed}=await import('@/mock/store');
const {IDS}=await import('@/mock/data');
const {GET}=await import('@/app/demo/start/[persona]/route');
const original=process.env.DEMO_MODE;
beforeAll(()=>{process.env.DEMO_MODE='on';});
afterAll(()=>{if(original===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=original;});
const seaside=IDS.buildings.seaside;
// `redirect()` from next/navigation throws an error whose digest carries the target URL.
async function redirectOf(run:()=>Promise<unknown>):Promise<string>{
 try{await run();}catch(e){const digest=(e as {digest?:unknown}).digest;if(typeof digest==='string')return digest.split(';')[2];throw e;}
 throw new Error('expected a redirect');
}
describe('demo personas',()=>{
 it('lists the five people in order, each a distinct seed user',()=>{
  expect(PERSONAS.map(p=>p.id)).toEqual(['platform','owner','strata','building','resident']);
  expect(PERSONAS.map(p=>p.name)).toEqual(['Alex Kim','Dana Ruiz','Sarah Chen','James Park','Priya Nair']);
  expect(new Set(PERSONAS.map(p=>p.userId)).size).toBe(5);
  const s=seed();
  for(const p of PERSONAS)expect(s.profiles.some(x=>x.id===p.userId)).toBe(true);
  expect(persona('admin')).toBeUndefined();
 });
 it('lands each person where their role begins',()=>{
  const s=seed();
  const path=(id:string)=>landingPath(persona(id)!,s);
  expect(path('platform')).toBe('/demo/admin');
  expect(path('owner')).toBe('/demo/workspace');
  expect(path('strata')).toBe('/demo/workspace');
  // TODO(Task 3/4): building and resident move to /demo/b/<seaside>/home once those home screens exist.
  expect(path('building')).toBe(`/demo/b/${seaside}/ask`);
  expect(path('resident')).toBe(`/demo/b/${seaside}/documents`);
 });
 it('redirects the old admin start link to the firm owner',async()=>{
  jar.clear();
  expect(await redirectOf(()=>GET(new Request('http://x/demo/start/admin'),{params:Promise.resolve({persona:'admin'})}))).toBe('/demo/start/owner');
  expect(jar.has('demo_session')).toBe(false);// the alias itself starts no session
  expect(await redirectOf(()=>GET(new Request('http://x/demo/start/owner'),{params:Promise.resolve({persona:'owner'})}))).toBe('/demo/workspace');
  expect(jar.get('demo_persona')).toBe('owner');
 });
 it('404s an unknown persona',async()=>{
  const res=await GET(new Request('http://x/demo/start/nobody'),{params:Promise.resolve({persona:'nobody'})});
  expect((res as Response).status).toBe(404);
 });
});
