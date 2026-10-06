import 'server-only';
import { cookies } from 'next/headers';
import { demoEnabled } from '@/lib/env';
import { persona, type Persona, type PersonaId } from './personas';
import { newId } from './store';
const SESSION_COOKIE = 'demo_session';
const PERSONA_COOKIE = 'demo_persona';
export async function demoSession(): Promise<{ sessionId: string; persona: Persona } | null> {
  // With the demo off there is no demo session, whatever cookies arrive, so no mock action or read can run.
  if (!demoEnabled()) return null;
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const personaId = jar.get(PERSONA_COOKIE)?.value;
  if (!sessionId || !personaId) return null;
  const p = persona(personaId);
  return p ? { sessionId, persona: p } : null;
}
export async function startDemo(id: PersonaId): Promise<string | null> {
  if (!demoEnabled()) return null;
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
  // Switching persona keeps the same demo session — its store is the shared "world" every person in it acts
  // on, so a change one person makes (e.g. sending a draft for review) is visible to the next (e.g. that
  // draft showing up in another person's review inbox). Only `resetDemoAction` reseeds it. A session id is
  // only minted when the browser doesn't already have one (first visit, or after `endDemo`/sign-out).
  const sessionId = jar.get(SESSION_COOKIE)?.value ?? newId();
  jar.set(SESSION_COOKIE, sessionId, options);
  jar.set(PERSONA_COOKIE, id, options);
  return sessionId;
}
export async function endDemo(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PERSONA_COOKIE);
}
