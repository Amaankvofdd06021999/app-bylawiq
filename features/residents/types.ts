// Prop types for the resident (paying owner) screens. The page that renders them (demo: `mock/residents.ts`)
// decides what the person may see — owner-visible building passages and the legal corpus only, never a firm's
// internal knowledge — so these components never fetch anything themselves.
/** A passage a resident tool cites: a building passage from an owner-visible document, or a legal passage. */
export type CitedPassage={kind:'building'|'legal';title:string;sectionRef:string|null;content:string;citation:string|null};
/** A plain-language summary of one owner-visible bylaw or rule section, with the passage it explains. */
export type Explainer={id:string;label:string;sectionRef:string;/** "Bylaw 3.1" or "Rule R.6". */sectionName:string;summary:string[];facts:string[];source:CitedPassage};
export type ResidentDraftKind='notice_to_council'|'letter_reply';
export type ResidentDraftView={id:string;kind:ResidentDraftKind;title:string;body:string;meaning:string[];sources:CitedPassage[];createdAt:string};
export type CreditEntry={id:string;at:string;label:string;delta:number};
/** What each paid tool costs, in credits (`free` marks the questions that come free first). */
export type Prices={question:number;draftNotice:number;letterReply:number;pack:{credits:number;price:number}};
export type ResidentData={
 firstName:string;name:string;unit:string|null;
 building:{id:string;name:string};
 /** Resident AI is on for this building (the platform flag). Off pauses Ask, explainers and drafting. */
 aiOn:boolean;
 wallet:{credits:number;freeLeft:number;freeTotal:number};
 prices:Prices;
 alerts:{id:string;title:string;body:string;at:string}[];
 documents:{id:string;title:string;type:string;at:string}[];
 history:CreditEntry[];
 drafts:ResidentDraftView[];
 explainers:Explainer[];
};
/** Result of a paid drafting tool: the saved draft, or why not (`paywall` when the credits don't cover it). */
export type DraftResult={ok:true;draft:ResidentDraftView;credits:number}|{ok:false;error:string;paywall?:boolean;/** The current balance, with `paywall`. */credits?:number};
export type DraftInput={kind:'notice_to_council';buildingId:string;topic:string;happened:string;request:string}|{kind:'letter_reply';buildingId:string;letter:string;response:string};
