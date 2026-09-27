import {createHash} from 'node:crypto';
import type {Building,Row} from '@/lib/schema';
import {IDS} from './ids';
import {uid} from './uid';
// Mirrors `public.organizations`: Coastline Strata is the firm; every building owns its own `kind:'building'`
// organization (see supabase/migrations/20260927091000_building_orgs.sql), which a firm reaches only through
// a `firm_building_links` row.
export const organizations:Row[]=[
 {id:IDS.orgs.coastline,name:'Coastline Strata Management',kind:'firm',plan:'growth',letterhead:'Coastline Strata Management · 900–1500 West Georgia St, Vancouver, BC',signature_block:'The Coastline team',created_at:'2024-11-04T09:00:00Z'},
 {id:IDS.orgs.harbourOrg,name:'Harbour View',kind:'building',plan:'pilot',letterhead:'',signature_block:'',created_at:'2025-02-10T09:00:00Z'},
 {id:IDS.orgs.marinaOrg,name:'Marina Court',kind:'building',plan:'pilot',letterhead:'',signature_block:'',created_at:'2025-03-18T09:00:00Z'},
 {id:IDS.orgs.seasideOrg,name:'Seaside Towers',kind:'building',plan:'pilot',letterhead:'',signature_block:'',created_at:'2025-01-22T09:00:00Z'},
 {id:IDS.orgs.parksideOrg,name:'Parkside',kind:'building',plan:'pilot',letterhead:'',signature_block:'',created_at:'2025-05-06T09:00:00Z'},
];
// Mirrors `public.org_members`: Coastline's own staff, plus the on-site manager each building started with —
// Harbour and Seaside keep theirs even after linking to Coastline, the same way a real linked building's own
// staff stay org members of their own building org.
export const orgMembers:Row[]=[
 {id:uid('12000000',1),org_id:IDS.orgs.coastline,user_id:IDS.users.dana,role:'org_owner',status:'active'},
 {id:uid('12000000',2),org_id:IDS.orgs.coastline,user_id:IDS.users.sarah,role:'portfolio_manager',status:'active'},
 {id:uid('12000000',3),org_id:IDS.orgs.coastline,user_id:IDS.users.leeWong,role:'portfolio_assistant',status:'active'},
 {id:uid('12000000',4),org_id:IDS.orgs.seasideOrg,user_id:IDS.users.james,role:'building_manager',status:'active'},
 {id:uid('12000000',5),org_id:IDS.orgs.parksideOrg,user_id:IDS.users.omar,role:'building_manager',status:'active'},
 {id:uid('12000000',6),org_id:IDS.orgs.harbourOrg,user_id:IDS.users.nina,role:'building_manager',status:'active'},
];
export const buildings:Building[]=[
 {id:IDS.buildings.harbour,org_id:IDS.orgs.harbourOrg,name:'Harbour View',strata_plan_no:'EPS 3312',address:'145 Harbour Rd, Victoria, BC',unit_count:86,municipality:'Victoria',corpus_version:1,jurisdiction_chain:[]},
 {id:IDS.buildings.marina,org_id:IDS.orgs.marinaOrg,name:'Marina Court',strata_plan_no:'LMS 2217',address:'88 Marina Way, Vancouver, BC',unit_count:54,municipality:'Vancouver',corpus_version:1,jurisdiction_chain:[]},
 {id:IDS.buildings.seaside,org_id:IDS.orgs.seasideOrg,name:'Seaside Towers',strata_plan_no:'EPS 4821',address:'210 Seaside Blvd, Surrey, BC',unit_count:132,municipality:'Surrey',corpus_version:2,jurisdiction_chain:[]},
 {id:IDS.buildings.parkside,org_id:IDS.orgs.parksideOrg,name:'Parkside',strata_plan_no:'LMS 987',address:'5 Parkside Cres, Burnaby, BC',unit_count:40,municipality:'Burnaby',corpus_version:1,jurisdiction_chain:[]},
];
// Mirrors `public.firm_building_links`. Harbour View, Marina Court and Seaside Towers are linked to Coastline;
// Parkside is not (it only has the unused code in `linkCodes` below).
export const firmLinks:Row[]=[
 {id:IDS.firmLinks.harbour,building_id:IDS.buildings.harbour,firm_org_id:IDS.orgs.coastline,status:'active',invited_by:IDS.users.dana,accepted_by:IDS.users.dana,revoked_by:null,created_at:'2025-02-11T09:00:00Z',accepted_at:'2025-02-11T09:00:00Z',revoked_at:null},
 {id:IDS.firmLinks.marina,building_id:IDS.buildings.marina,firm_org_id:IDS.orgs.coastline,status:'active',invited_by:IDS.users.dana,accepted_by:IDS.users.dana,revoked_by:null,created_at:'2025-03-19T09:00:00Z',accepted_at:'2025-03-19T09:00:00Z',revoked_at:null},
 {id:IDS.firmLinks.seaside,building_id:IDS.buildings.seaside,firm_org_id:IDS.orgs.coastline,status:'active',invited_by:IDS.users.sarah,accepted_by:IDS.users.james,revoked_by:null,created_at:'2025-01-23T09:00:00Z',accepted_at:'2025-01-24T10:00:00Z',revoked_at:null},
];
// Mirrors `public.link_codes`. `PARK-7QK4` is unused: Sarah (persona: strata manager) is meant to redeem it
// against Parkside in a later demo task. The plaintext code is never stored — only its sha256 hash, exactly
// like `lib/link-codes.ts#hashCode`.
export const linkCodes:Row[]=[
 {id:IDS.linkCodes.parkside,building_id:IDS.buildings.parkside,kind:'firm',code_hash:createHash('sha256').update('PARK-7QK4').digest('hex'),created_by:IDS.users.omar,expires_at:'2026-10-04T09:00:00Z',used_at:null,revoked_at:null,created_at:'2026-09-27T09:00:00Z'},
];
// Mirrors `public.building_members`. Firm staff join a linked building with `via_link_id` set (see
// `private.add_link_members` in supabase/migrations/20260927090000_firm_links_schema.sql); everyone else is a
// direct member of their own building. `unit` on Priya's row is a mock-only convenience (the real table has no
// such column — Row is a passthrough type).
export const members:Row[]=[
 ...([['dana','harbour','org_owner'],['dana','marina','org_owner'],['dana','seaside','org_owner'],
   ['sarah','harbour','portfolio_manager'],['sarah','marina','portfolio_manager'],['sarah','seaside','portfolio_manager'],
   ['leeWong','harbour','portfolio_assistant'],['leeWong','marina','portfolio_assistant'],['leeWong','seaside','portfolio_assistant']] as const)
  .map(([user,building,role],i)=>({id:uid('13000000',i+1),building_id:IDS.buildings[building],user_id:IDS.users[user],role,status:'active',expires_at:null,via_link_id:IDS.firmLinks[building]})),
 {id:uid('14000000',1),building_id:IDS.buildings.seaside,user_id:IDS.users.james,role:'building_manager',status:'active',expires_at:null,via_link_id:null},
 {id:uid('14000000',2),building_id:IDS.buildings.seaside,user_id:IDS.users.grace,role:'council_president',status:'active',expires_at:null,via_link_id:null},
 {id:uid('14000000',3),building_id:IDS.buildings.seaside,user_id:IDS.users.ben,role:'council_member',status:'active',expires_at:null,via_link_id:null},
 {id:uid('14000000',4),building_id:IDS.buildings.seaside,user_id:IDS.users.priya,role:'owner_resident',status:'active',expires_at:null,via_link_id:null,unit:'1204'},
 {id:uid('14000000',5),building_id:IDS.buildings.parkside,user_id:IDS.users.omar,role:'building_manager',status:'active',expires_at:null,via_link_id:null},
 {id:uid('14000000',6),building_id:IDS.buildings.harbour,user_id:IDS.users.nina,role:'building_manager',status:'active',expires_at:null,via_link_id:null},
];
