import {describe,it,expect} from 'vitest';
import {seed} from '@/mock/store';
import {IDS} from '@/mock/data';
import {answer} from '@/mock/answers';
import {NO_GROUNDING} from '@/lib/ai/citations';
describe('mock answers',()=>{
 it('cites the pets section for a dog question on Seaside',()=>{
  const s=seed();
  const result=answer(s,IDS.users.james,IDS.buildings.seaside,'Can I have a dog?');
  expect(result.sources.length).toBeGreaterThan(0);
  expect(result.sources[0].sectionRef).toBe('3.2');
  expect(result.sources[0].buildingId).toBe(IDS.buildings.seaside);
  expect(result.sources[0].content).toContain('pets');
  expect(result.answer.answer[0].text.startsWith('Demo answer from sample documents.')).toBe(true);
  expect(result.answer.answer[0].evidence[0].quote).toBe(result.sources[0].content);
 });
 it('returns the no-grounding state for a nonsense question',()=>{
  const s=seed();
  const result=answer(s,IDS.users.james,IDS.buildings.seaside,'asdkjf qwoeiru nonsense gibberish');
  expect(result.sources).toEqual([]);
  expect(result.answer.answer).toEqual([]);
  expect(result.answer.limitations).toBe(NO_GROUNDING);
 });
 it('never cites a chunk from a different building',()=>{
  const s=seed();
  const result=answer(s,IDS.users.dana,IDS.buildings.harbour,'Can I have a dog?');
  expect(result.sources.length).toBeGreaterThan(0);
  expect(result.sources.every(x=>x.buildingId===IDS.buildings.harbour)).toBe(true);
 });
});
