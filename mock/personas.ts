import {IDS} from './data';
import type {MockState} from './store';
import {accessibleBuildings,can,isPlatformAdmin,roleIn} from './rules';
export type PersonaId='platform'|'owner'|'strata'|'building'|'resident';
// Old persona ids still reachable through `/demo/start/<old>` links (app/demo/start/[persona]/route.ts).
export const PERSONA_ALIASES:Record<string,PersonaId>={admin:'owner'};
export type Persona={id:PersonaId;userId:string;name:string;email:string;title:string;description:string;accountType:'admin'|'multi_building'|'single_building'};
export const PERSONAS:Persona[]=[
 {id:'platform',userId:IDS.users.alex,name:'Alex Kim',email:'alex.kim@bylawiq.example',title:'Platform admin',description:'Runs BylawIQ itself. Sees customers, revenue and AI usage across every firm and building, and can pause AI help for residents — but never any building’s documents.',accountType:'admin'},
 {id:'owner',userId:IDS.users.dana,name:'Dana Ruiz',email:'dana.ruiz@coastlinestrata.example',title:'Firm owner',description:'Owns Coastline Strata Management. Sees her team, review turnaround, plan and firm knowledge across Harbour View, Marina Court and Seaside Towers.',accountType:'admin'},
 {id:'strata',userId:IDS.users.sarah,name:'Sarah Chen',email:'sarah.chen@coastlinestrata.example',title:'Strata manager',description:'Manages Coastline’s three buildings day to day. Starts with what needs attention today, reviews drafts, and gets Coastline’s internal practice alongside the bylaws in answers.',accountType:'multi_building'},
 {id:'building',userId:IDS.users.james,name:'James Park',email:'james.park@seasidetowers.example',title:'Building manager',description:'Runs Seaside Towers on site. Sees one building’s health, drafts under review with Coastline, council tasks and seats — never Coastline’s internal knowledge.',accountType:'single_building'},
 {id:'resident',userId:IDS.users.priya,name:'Priya Nair',email:'priya.nair@seasidetowers.example',title:'Resident',description:'Owns unit 1204 at Seaside Towers and pays with credits. Asks about her bylaws, reads plain-language explainers and drafts letters to council, from owner documents only.',accountType:'single_building'},
];
export function persona(id:string):Persona|undefined{return PERSONAS.find(p=>p.id===id);}
export function landingPath(p:Persona,store:MockState):string{
 // The platform admin has no building memberships; their home is the admin dashboard.
 if(isPlatformAdmin(store,p.userId))return '/demo/admin';
 if(p.accountType!=='single_building')return '/demo/workspace';
 const building=accessibleBuildings(store,p.userId)[0];
 if(!building)return '/demo/workspace';
 // Building staff with Ask land on the building home, and a resident on their own resident home.
 return can(store,p.userId,'chat.use',building.id)||roleIn(store,p.userId,building.id)==='owner_resident'?`/demo/b/${building.id}/home`:`/demo/b/${building.id}/documents`;
}
