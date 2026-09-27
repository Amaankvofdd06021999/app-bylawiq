import {describe,it,expect,beforeEach,afterAll,vi} from 'vitest';
// A forged demo cookie jar, as an attacker would send alongside a Next-Action POST.
const jar=new Map<string,string>([['demo_session','forged-session'],['demo_persona','owner']]);
vi.mock('next/headers',()=>({cookies:async()=>({
 get:(name:string)=>jar.has(name)?{name,value:jar.get(name)!}:undefined,
 set:(name:string,value:string)=>{jar.set(name,value);},
 delete:(name:string)=>{jar.delete(name);},
})}));
vi.mock('next/cache',()=>({revalidatePath:()=>{}}));
// Spec §3.3: every /demo and /api/demo route is a 404 unless DEMO_MODE=on.
const original=process.env.DEMO_MODE;
beforeEach(()=>{delete process.env.DEMO_MODE;});
afterAll(()=>{if(original===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=original;});
describe('demo gate',()=>{
 it('404s the demo chat API when DEMO_MODE is unset',async()=>{
  const {POST}=await import('@/app/api/demo/chat/route');
  const res=await POST(new Request('http://x/api/demo/chat',{method:'POST',body:'{}'}));
  expect(res.status).toBe(404);
 });
 it('404s the demo start route when DEMO_MODE is unset',async()=>{
  const {GET}=await import('@/app/demo/start/[persona]/route');
  const res=await GET(new Request('http://x/demo/start/owner'),{params:Promise.resolve({persona:'owner'})});
  expect(res.status).toBe(404);
 });
 it('404s every /demo and /api/demo path in the proxy when DEMO_MODE is unset, and leaves other paths alone',async()=>{
  const {NextRequest}=await import('next/server');
  const {proxy}=await import('@/proxy');
  for(const path of ['/demo','/demo/workspace','/demo/start/owner','/api/demo/chat'])expect((await proxy(new NextRequest('http://x'+path))).status).toBe(404);
  expect((await proxy(new NextRequest('http://x/demonstration'))).status).toBe(200);
  process.env.DEMO_MODE='on';expect((await proxy(new NextRequest('http://x/demo'))).status).toBe(200);
 });
 it('refuses mock server actions with forged demo cookies when DEMO_MODE is unset, without creating a store',async()=>{
  const actions=await import('@/mock/actions');
  const {hasStore}=await import('@/mock/store');
  const {demoSession}=await import('@/mock/session');
  expect(await demoSession()).toBeNull();
  const r=await actions.mutateAction({action:'chat.rename',buildingId:'x',id:'y',values:{title:'z'}});
  expect(r.ok).toBe(false);
  expect((await actions.createChatAction({})).ok).toBe(false);
  await actions.resetDemoAction();await actions.switchPersonaAction('resident');await actions.signOutAction();
  expect(hasStore('forged-session')).toBe(false);
  expect(jar.get('demo_persona')).toBe('owner');// switchPersonaAction and signOutAction left the cookies alone
 });
 it('reports the demo as disabled unless DEMO_MODE is exactly on',async()=>{
  const {demoEnabled}=await import('@/lib/env');
  expect(demoEnabled()).toBe(false);
  process.env.DEMO_MODE='true';expect(demoEnabled()).toBe(false);
  process.env.DEMO_MODE='on';expect(demoEnabled()).toBe(true);
 });
});
