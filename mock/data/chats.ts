import {IDS} from './ids';
import {uid} from './uid';
// One chat owned by James on Seaside, reusing the sample conversation shape from `lib/preview.ts` (now
// grounded in Seaside's own visitor-parking provision instead of the generic sample text).
export const chats=[
 {id:IDS.chats.jamesConversation,building_id:IDS.buildings.seaside,user_id:IDS.users.james,title:'Can residents use visitor parking?',scope:'building' as const,scope_building_ids:[],as_of:null,source_types:[],agent_deployment_id:null,updated_at:'2026-09-20T09:05:00Z',archived:false},
];
export const messages:{id:string;chatId:string;role:'user'|'assistant';parts:unknown[]}[]=[
 {id:uid('1d000000',1),chatId:IDS.chats.jamesConversation,role:'user',parts:[{type:'text',text:'Can residents use visitor parking?'}]},
 {id:uid('1d000000',2),chatId:IDS.chats.jamesConversation,role:'assistant',parts:[{type:'data-answer',id:'grounded-answer',data:{answer:{answer:[{text:'Demo answer from sample documents. Visitor parking permits are issued by the building manager and are valid for 72 hours.',evidence:[{source:1,quote:'Visitor parking permits are issued by the building manager and are valid for 72 hours.'}]}],basis:[{text:'The registered bylaws describe how a visitor permit is issued and how long it is valid.',evidence:[{source:1,quote:'Visitor parking permits are issued by the building manager and are valid for 72 hours.'}]}],nextSteps:[{text:'Direct the resident to request a permit from the building manager before the visit.',evidence:[{source:1,quote:'EV charging stalls are reserved for vehicles registered with the manager.'}]}],limitations:'Demo answer from sample documents. No real building documents or live legal sources were searched.'},sources:[{id:1,chunkId:uid('1d000001',1),kind:'building',title:'Registered bylaws · Consolidated 2025',content:'Visitor parking permits are issued by the building manager and are valid for 72 hours. EV charging stalls are reserved for vehicles registered with the manager.',sectionRef:'4.1',effectiveDate:'2025-03-12',buildingId:IDS.buildings.seaside,page:4,citation:null}]}}]},
];
