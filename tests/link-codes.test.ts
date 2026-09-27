import {describe,it,expect} from 'vitest';
import {generateCode,normalizeCode,hashCode} from '@/lib/link-codes';
describe('link codes',()=>{
 it('generates codes in the XXXX-XXXX format without ambiguous characters',()=>{for(let i=0;i<200;i++)expect(generateCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);});
 it('accepts lowercase, spaces and a missing dash',()=>{expect(normalizeCode(' seas 7qk4 ')).toBe('SEAS-7QK4');expect(normalizeCode('seas7qk4')).toBe('SEAS-7QK4');expect(normalizeCode('SEAS–7QK4')).toBe('SEAS-7QK4');});
 it('rejects input of the wrong length or with ambiguous characters',()=>{expect(normalizeCode('SEAS-7QK')).toBeNull();expect(normalizeCode('SEAS-7QK40')).toBeNull();expect(normalizeCode('SEAS-0QK4')).toBeNull();});
 it('hashes the normalized code so typing style does not matter',()=>{expect(hashCode('SEAS-7QK4')).toMatch(/^[0-9a-f]{64}$/);expect(hashCode(normalizeCode('seas7qk4')!)).toBe(hashCode('SEAS-7QK4'));});
});
