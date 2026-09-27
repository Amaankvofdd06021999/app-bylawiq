import {describe,it,expect} from 'vitest';
import {groupClaims,OTHER_BUILDING} from '@/features/chat/group-claims';
import type {Source} from '@/lib/ai/citations';
const A='00000000-0000-4000-8000-00000000000a',B='00000000-0000-4000-8000-00000000000b',C='00000000-0000-4000-8000-00000000000c',X='00000000-0000-4000-8000-0000000000ff';
const buildings=[{id:A,name:'Seaside Towers'},{id:B,name:'Harbour View'},{id:C,name:'Marina Court'}];
let n=0;
const src=(kind:Source['kind'],buildingId:string|null,extra:Partial<Source>={}):Source=>({id:++n,chunkId:crypto.randomUUID(),kind,title:'T',content:'passage '+n,sectionRef:null,effectiveDate:null,buildingId,page:null,citation:null,...extra});
const claim=(...ids:number[])=>({text:'claim '+ids.join(','),evidence:ids.map(id=>({source:id,quote:'passage '+id}))});
describe('groupClaims',()=>{
 it('puts each building under its own heading, active first, then others alphabetically, then law, firm and other',()=>{
  n=0;
  const sources=[src('building',B),src('building',A),src('building',C),src('legal',null),src('firm',null,{firmName:'Coastline Strata Management',citation:'Coastline Strata Management · Policies · internal practice'})];
  const groups=groupClaims([claim(1),claim(2),claim(3),claim(4),claim(5),claim(99)],sources,buildings,A);
  expect(groups.map(g=>g.heading)).toEqual(['What Seaside Towers’ bylaws and documents say','What Harbour View’s bylaws and documents say','What Marina Court’s bylaws and documents say','What the law says','How Coastline Strata Management handles this (internal practice — not law or bylaw)','Other sources']);
  expect(groups[0].claims).toEqual([claim(2)]);
  expect(groups[1].claims).toEqual([claim(1)]);
 });
 it('never lets two buildings’ sources share a heading',()=>{
  n=0;
  const sources=[src('building',A),src('building',B),src('building',A),src('building',B)];
  const groups=groupClaims([claim(1),claim(2),claim(3),claim(4),claim(1,2)],sources,buildings,A);
  for(const g of groups){
   const ids=new Set(g.claims.flatMap(c=>c.evidence.map(e=>sources.find(s=>s.id===e.source)!.buildingId)));
   if(g.kind==='building')expect(ids.size).toBe(1);
  }
  // A claim citing two buildings is not put under either building's heading.
  expect(groups.find(g=>g.kind==='other')?.claims).toEqual([claim(1,2)]);
 });
 it('never labels an unknown building as the active building',()=>{
  n=0;
  const sources=[src('building',X),src('building',null),src('building',A)];
  const groups=groupClaims([claim(1),claim(2),claim(3)],sources,buildings,A);
  expect(groups[0].heading).toBe('What Seaside Towers’ bylaws and documents say');
  expect(groups[0].claims).toEqual([claim(3)]);
  const unknown=groups.filter(g=>g.claims.some(c=>c.evidence[0].source!==3));
  expect(unknown.length).toBe(2);
  for(const g of unknown)expect(g.heading).toBe(OTHER_BUILDING);
  expect(groups.filter(g=>g.heading.includes('Seaside Towers')).length).toBe(1);
 });
 it('falls back to the citation for the firm name on sources stored before firmName existed',()=>{
  n=0;
  const sources=[src('firm',null,{citation:'Coastline Strata Management · Policies · internal practice'})];
  expect(groupClaims([claim(1)],sources,buildings,A)[0].heading).toBe('How Coastline Strata Management handles this (internal practice — not law or bylaw)');
 });
});
