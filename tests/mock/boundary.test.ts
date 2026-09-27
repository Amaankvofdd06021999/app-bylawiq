import {describe,it,expect} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
// Spec §3.7: the demo is fenced off. Only the demo's own folders may import the mock; the real app never does.
const root=path.resolve('.');
const allowed=['mock','app/demo','app/api/demo','tests'].map(p=>path.join(root,p));
const skipped=new Set(['node_modules','.next','.git','.superpowers','.vercel','coverage','playwright-report','test-results']);
function files(dir:string):string[]{
 return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const full=path.join(dir,e.name);
  if(e.isDirectory())return skipped.has(e.name)||allowed.includes(full)?[]:files(full);
  return /\.(ts|tsx)$/.test(e.name)&&!e.name.endsWith('.d.ts')?[full]:[];
 });
}
// Static (`from '…'`), side-effect (`import '…'`), dynamic (`import('…')`) and `require('…')` imports alike.
const mockImport=/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:@\/mock|[^'"]*\/mock)(?:\/[^'"]*)?['"]/;
describe('demo import boundary',()=>{
 it('scans the app',()=>{expect(files(root).length).toBeGreaterThan(20);});
 it('recognises every import form',()=>{
  for(const line of ["import {x} from '@/mock/api';","import '@/mock/store';","await import('@/mock/actions')","require('../mock/session')","const a=require( \"@/mock\" )"])expect(mockImport.test(line)).toBe(true);
  for(const line of ["import {x} from '@/lib/mockup';","import '@/features/mocked';","const mock='x'"])expect(mockImport.test(line)).toBe(false);
 });
 it('has no imports of the mock outside the demo folders',()=>{
  const offenders=files(root).filter(f=>mockImport.test(readFileSync(f,'utf8'))).map(f=>path.relative(root,f));
  expect(offenders).toEqual([]);
 });
});
