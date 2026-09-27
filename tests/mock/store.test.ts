import {describe,it,expect} from 'vitest';
import {seed,getStore,resetStore,hasStore,MAX_SESSIONS} from '@/mock/store';
import {IDS} from '@/mock/data';
describe('mock store',()=>{
 it('gives independent sessions their own copy',()=>{
  const a=getStore('a');const b=getStore('b');
  a.documents.push({id:'x',building_id:IDS.buildings.seaside,title:'Injected'});
  expect(b.documents.some(d=>d.id==='x')).toBe(false);
 });
 it('restores the seed for a session on reset',()=>{
  const s=getStore('reset-me');const before=s.documents.length;
  s.documents.push({id:'y',building_id:IDS.buildings.seaside,title:'Temp'});
  expect(getStore('reset-me').documents.length).toBe(before+1);
  resetStore('reset-me');
  expect(getStore('reset-me').documents.length).toBe(before);
 });
 it('returns a fresh clone from seed() every call',()=>{
  const first=seed();first.documents.push({id:'z',building_id:IDS.buildings.seaside,title:'Temp'});
  const second=seed();
  expect(second.documents.some(d=>d.id==='z')).toBe(false);
 });
 it('evicts the least recently used session beyond the cap',()=>{
  getStore('lru-first');getStore('lru-second');
  for(let i=0;i<MAX_SESSIONS-2;i++)getStore('lru-fill-'+i);
  getStore('lru-first');// touch it, so lru-second is now the oldest
  getStore('lru-new');
  expect(hasStore('lru-first')).toBe(true);
  expect(hasStore('lru-second')).toBe(false);
  expect(hasStore('lru-new')).toBe(true);
 });
});
