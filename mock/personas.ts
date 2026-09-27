import {IDS} from './data';
import type {MockState} from './store';
import {accessibleBuildings,can} from './rules';
export type PersonaId='admin'|'strata'|'building'|'resident';
export type Persona={id:PersonaId;userId:string;name:string;email:string;title:string;description:string;accountType:'admin'|'multi_building'|'single_building'};
export const PERSONAS:Persona[]=[
 {id:'admin',userId:IDS.users.dana,name:'Dana Ruiz',email:'dana.ruiz@coastlinestrata.example',title:'Admin',description:'Owns Coastline Strata Management and sees every linked building: Harbour View, Marina Court and Seaside Towers.',accountType:'admin'},
 {id:'strata',userId:IDS.users.sarah,name:'Sarah Chen',email:'sarah.chen@coastlinestrata.example',title:'Strata manager',description:'Manages the same three buildings day to day, with two drafts waiting on review and an unused join code for Parkside.',accountType:'multi_building'},
 {id:'building',userId:IDS.users.james,name:'James Park',email:'james.park@seasidetowers.example',title:'Building manager',description:'Runs Seaside Towers on site, with Coastline linked as the strata management firm and one draft sent back with changes requested.',accountType:'single_building'},
 {id:'resident',userId:IDS.users.priya,name:'Priya Nair',email:'priya.nair@seasidetowers.example',title:'Resident',description:'Owns unit 1204 at Seaside Towers and can see only the documents marked visible to owners.',accountType:'single_building'},
];
export function persona(id:string):Persona|undefined{return PERSONAS.find(p=>p.id===id);}
export function landingPath(p:Persona,store:MockState):string{
 if(p.accountType!=='single_building')return '/demo/workspace';
 const building=accessibleBuildings(store,p.userId)[0];
 if(!building)return '/demo/workspace';
 return can(store,p.userId,'chat.use',building.id)?`/demo/b/${building.id}/ask`:`/demo/b/${building.id}/documents`;
}
