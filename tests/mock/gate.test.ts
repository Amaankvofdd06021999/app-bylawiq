import {describe,it,expect,beforeEach,afterAll} from 'vitest';
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
  const res=await GET(new Request('http://x/demo/start/admin'),{params:Promise.resolve({persona:'admin'})});
  expect(res.status).toBe(404);
 });
 it('404s every /demo and /api/demo path in the proxy when DEMO_MODE is unset, and leaves other paths alone',async()=>{
  const {NextRequest}=await import('next/server');
  const {proxy}=await import('@/proxy');
  for(const path of ['/demo','/demo/workspace','/demo/start/admin','/api/demo/chat'])expect((await proxy(new NextRequest('http://x'+path))).status).toBe(404);
  expect((await proxy(new NextRequest('http://x/demonstration'))).status).toBe(200);
  process.env.DEMO_MODE='on';expect((await proxy(new NextRequest('http://x/demo'))).status).toBe(200);
 });
 it('reports the demo as disabled unless DEMO_MODE is exactly on',async()=>{
  const {demoEnabled}=await import('@/lib/env');
  expect(demoEnabled()).toBe(false);
  process.env.DEMO_MODE='true';expect(demoEnabled()).toBe(false);
  process.env.DEMO_MODE='on';expect(demoEnabled()).toBe(true);
 });
});
