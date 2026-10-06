import type { Profile } from '@/lib/schema';
import { IDS } from './ids';
// One profile row per seed user (mirrors `public.profiles`: id, display_name, account_type, bound_building_id).
// The five persona users (Alex, Dana, Sarah, James, Priya) are also described in `mock/personas.ts`; the rest are
// background people who make member lists, reviews and org rows realistic.
export const profiles: Profile[] = [
  // Alex is BylawIQ's own platform admin: no org or building membership anywhere (see `platform.admins`).
  { id: IDS.users.alex, display_name: 'Alex Kim', account_type: 'admin', bound_building_id: null },
  { id: IDS.users.dana, display_name: 'Dana Ruiz', account_type: 'admin', bound_building_id: null },
  {
    id: IDS.users.sarah,
    display_name: 'Sarah Chen',
    account_type: 'multi_building',
    bound_building_id: null,
  },
  {
    id: IDS.users.leeWong,
    display_name: 'Lee Wong',
    account_type: 'multi_building',
    bound_building_id: null,
  },
  {
    id: IDS.users.james,
    display_name: 'James Park',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.grace,
    display_name: 'Grace Liu',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.ben,
    display_name: 'Ben Ortiz',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.priya,
    display_name: 'Priya Nair',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.seaside,
  },
  {
    id: IDS.users.omar,
    display_name: 'Omar Haddad',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.parkside,
  },
  {
    id: IDS.users.nina,
    display_name: 'Nina Patel',
    account_type: 'single_building',
    bound_building_id: IDS.buildings.harbour,
  },
];
