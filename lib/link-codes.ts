import 'server-only';
import { createHash, randomInt } from 'node:crypto';
// No 0/O or 1/I, so codes survive being read aloud or copied from paper.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}
export function normalizeCode(input: string) {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 8 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return s.slice(0, 4) + '-' + s.slice(4);
}
export function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}
