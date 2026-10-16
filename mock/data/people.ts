import type { Profile } from '@/lib/schema';
import { IDS } from './ids';
// One profile row per seed user (mirrors `public.profiles`: id, display_name, consent_at, bound_building_id).
// The five persona users (Alex, Dana, Sarah, James, Priya) are also described in `mock/personas.ts`; the rest are
// background people who make member lists, reviews and org rows realistic.
export const profiles: Profile[] = [
  // Alex is BylawIQ's own platform admin: no org or building membership anywhere (see `platform.admins`).
  {
    id: IDS.users.alex,
    display_name: 'Alex Kim',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: null,
  },
  {
    id: IDS.users.dana,
    display_name: 'Dana Ruiz',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: null,
  },
  {
    id: IDS.users.sarah,
    display_name: 'Sarah Chen',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: null,
  },
  {
    id: IDS.users.leeWong,
    display_name: 'Lee Wong',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: null,
  },
  {
    id: IDS.users.james,
    display_name: 'James Park',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.grace,
    display_name: 'Grace Liu',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.ben,
    display_name: 'Ben Ortiz',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.priya,
    display_name: 'Priya Nair',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.omar,
    display_name: 'Omar Haddad',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.parkside,
  },
  {
    id: IDS.users.nina,
    display_name: 'Nina Patel',
    consent_at: '2026-01-01T00:00:00.000Z',
    bound_building_id: IDS.buildings.harbour,
  },
];
