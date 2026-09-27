import type {PlatformState} from '@/mock/store';
import {IDS} from './ids';
import {uid} from './uid';
// BylawIQ's own view of its customers, for the platform admin (Alex). Aggregates only — no building document
// content lives here. Prices are monthly CAD; `mrr` is what the customer pays now (0 while on trial or when
// billed through a firm), `list_price` is the undiscounted price.
const plan=(n:number,org_id:string,customer:string,kind:'firm'|'building',x:{plan:string;plan_label:string;list_price:number;price:number;launch_discount:boolean;seats_included:number;status:'active'|'trial';mrr:number;since:string;billed_to?:string})=>({id:uid('36000000',n),org_id,customer,kind,...x});
const usage=(n:number,building_id:string,org_id:string,questions:number,no_grounding:number,est_cost_usd:number,resident_credit_sales:number)=>({id:uid('36100000',n),building_id,org_id,month:'2026-09',questions,no_grounding,est_cost_usd,resident_credit_sales});
export const platform:PlatformState={
 plans:[
  plan(1,IDS.orgs.coastline,'Coastline Strata Management','firm',{plan:'strata_manager',plan_label:'Strata Manager',list_price:199,price:99.5,launch_discount:true,seats_included:5,status:'active',mrr:99.5,since:'2024-11-04'}),
  plan(2,IDS.orgs.seasideOrg,'Seaside Towers','building',{plan:'building',plan_label:'Building',list_price:99,price:99,launch_discount:false,seats_included:3,status:'active',mrr:99,since:'2025-01-22'}),
  plan(3,IDS.orgs.harbourOrg,'Harbour View','building',{plan:'firm_linked',plan_label:'Included in Coastline’s plan',list_price:0,price:0,launch_discount:false,seats_included:0,status:'active',mrr:0,since:'2025-02-10',billed_to:IDS.orgs.coastline}),
  plan(4,IDS.orgs.marinaOrg,'Marina Court','building',{plan:'firm_linked',plan_label:'Included in Coastline’s plan',list_price:0,price:0,launch_discount:false,seats_included:0,status:'active',mrr:0,since:'2025-03-18',billed_to:IDS.orgs.coastline}),
  plan(5,IDS.orgs.parksideOrg,'Parkside','building',{plan:'building',plan_label:'Building',list_price:99,price:99,launch_discount:false,seats_included:3,status:'trial',mrr:0,since:'2025-05-06'}),
 ],
 usage:[
  usage(1,IDS.buildings.seaside,IDS.orgs.seasideOrg,214,9,18.4,20),
  usage(2,IDS.buildings.harbour,IDS.orgs.harbourOrg,132,6,11.2,0),
  usage(3,IDS.buildings.marina,IDS.orgs.marinaOrg,88,5,7.5,0),
  usage(4,IDS.buildings.parkside,IDS.orgs.parksideOrg,12,3,1.1,0),
 ],
 // Resident AI is on in the demo so Priya can ask; the admin screen labels it as needing legal sign-off.
 flags:{residentAi:true},
 audit:[
  {id:uid('36200000',1),actor_id:IDS.users.alex,action:'legal_corpus.sync',target_id:null,summary:'Legal corpus refreshed',occurred_at:'2026-09-01T09:00:00Z'},
  {id:uid('36200000',2),actor_id:IDS.users.alex,action:'plan.update',target_id:IDS.orgs.coastline,summary:'Launch price applied to a firm plan',occurred_at:'2026-08-15T14:30:00Z'},
  {id:uid('36200000',3),actor_id:IDS.users.alex,action:'flag.update',target_id:null,summary:'Resident AI turned on for the demo',occurred_at:'2026-08-30T10:00:00Z'},
  {id:uid('36200000',4),actor_id:IDS.users.alex,action:'trial.start',target_id:IDS.orgs.parksideOrg,summary:'Building trial started',occurred_at:'2025-05-06T09:00:00Z'},
 ],
 admins:[IDS.users.alex],
};
