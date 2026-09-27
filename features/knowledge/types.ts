// Prop types for firm knowledge management (the Firm tab of Knowledge). The page (demo: `mock/mutations/
// firm-knowledge.ts#firmKnowledgeView`) only builds this for staff of the firm; residents, building managers and
// council never receive it.
export type FirmCollectionId='templates'|'policies'|'guidance'|'legal_tracker';
export type FirmDocView={id:string;collection:FirmCollectionId;title:string;body:string;parts:number;updatedAt:string;author:string};
export type FirmKnowledgeData={
 firm:{id:string;name:string};
 /** Firm owner, admins and portfolio managers may add, edit and delete; assistants read only. */
 canEdit:boolean;
 collections:{id:FirmCollectionId;label:string;docs:FirmDocView[]}[];
};
export type FirmDocInput={id?:string;collection:FirmCollectionId;title:string;body:string};
