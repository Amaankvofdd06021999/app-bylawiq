import type {Layer,MockState} from './store';
import {newId} from './store';
import {layersFor,linkedFirmId,visibleDocuments} from './rules';
import {FIRM_COLLECTIONS} from './data/firm-knowledge';
import {NO_GROUNDING,type Source} from '@/lib/ai/citations';
import type {AnswerData} from '@/lib/chat-types';
// Pure mock stand-in for `features/chat/retrieval.ts` plus the model call in `features/chat/stream.ts`: no
// model runs here, only a keyword match against the seeded chunks in `mock/data/documents.ts`, so a demo
// answer can never say something a real, source-grounded answer could not also point to (AGENTS.md §5).
const PREFIX='Demo answer from sample documents.';
// Every keyword below is copied from the seeded bylaw/rules text itself (mock/data/documents.ts), across all
// four buildings, so a question phrased with any one synonym ("dog") still reaches a building's own chunk
// even when that building's own text uses a different one ("pets", "cat").
const TOPICS:readonly string[][]=[
 ['pet','pets','dog','dogs','cat','cats','animal'],
 ['noise','quiet','loud'],
 ['park','parking','stall','stalls','vehicle'],
 ['rent','rental','rentals','lease','tenant'],
 ['move-in','move in','deposit','moving'],
 ['fine','fines','contravention','warning'],
 ['elevator'],
 ['insurance','liability','coverage'],
 ['financial','budget','expense','expenses'],
 ['reserve fund','contingency'],
 ['council','minutes','agm','annual general meeting'],
 ['strata plan','common property','boundaries'],
];
const hasWord=(text:string,word:string)=>new RegExp('\\b'+word+'\\b','i').test(text);
function noGrounding():AnswerData{return {answer:{answer:[],basis:[],nextSteps:[],limitations:NO_GROUNDING},sources:[]};}
// A candidate passage from any layer, before it becomes a numbered `Source`.
type Hit={kind:Layer;title:string;content:string;sectionRef:string|null;effectiveDate:string|null;buildingId:string|null;citation:string|null;firmName:string|null;haystack:string};
// How many passages each layer may contribute: 2+2+2 keeps within `answerSchema`'s six answer claims.
const PER_LAYER=2,MAX_CLAIMS=6;
const FINE_TOPIC=TOPICS.find(t=>t.includes('fine'))!;
const possessive=(name:string)=>name+(name.endsWith('s')?'’':'’s');
const matches=(text:string,words:readonly string[])=>words.some(w=>text.includes(w));
/** Dollar amounts in a passage, keyed by the specific (non-fine) question topics named in the same sentence.
 * Only amounts sharing a subject are compared — "noise … $100" in a bylaw against "noise … $200" in guidance —
 * so a general maximum ("$200 for a bylaw, $50 for a rule") is never reported as a conflict. */
function amounts(content:string,topics:readonly (readonly string[])[]):{subjects:number[];value:number}[]{
 return content.split(/(?<=[.;])\s+/).flatMap(sentence=>{
  const lower=sentence.toLowerCase();
  const subjects=topics.map((t,i)=>t!==FINE_TOPIC&&matches(lower,t)?i:-1).filter(i=>i>=0);
  return [...sentence.matchAll(/\$(\d[\d,]*)/g)].map(m=>({subjects,value:Number(m[1].replace(/,/g,''))}));
 });
}
/** Mirrors `features/chat/retrieval.ts` + the answer half of `features/chat/stream.ts#generateAnswer`, but as
 * a pure keyword match instead of an embedding search and model call. Only the layers `layersFor` allows this
 * person on this building are searched, narrowed further by the `layers` the question asked for. The building
 * layer is only `buildingId`'s own documents that `visibleDocuments` lets this person read (owner-visible only
 * for a resident), exactly the way Postgres RLS scopes the real retrieval (AGENTS.md §0); the firm layer is
 * only the firm the building is linked to, and `layersFor` never gives it to building staff or residents. */
export function answer(s:MockState,userId:string,buildingId:string,question:string,layers?:readonly Layer[]):AnswerData{return answerOver(s,userId,[buildingId],question,layers);}
/** A portfolio question: the same search as `answer`, over every building in `buildingIds` (the caller has
 * already checked `chat.use_portfolio` on each). Each building's passages keep their own `buildingId`, so the
 * answer labels them building by building; the law and the firm's knowledge are searched once. */
export function answerPortfolio(s:MockState,userId:string,buildingIds:readonly string[],question:string,layers?:readonly Layer[]):AnswerData{return answerOver(s,userId,[...new Set(buildingIds)],question,layers);}
function answerOver(s:MockState,userId:string,buildingIds:readonly string[],question:string,layers?:readonly Layer[]):AnswerData{
 const allowedIn=new Map(buildingIds.map(b=>[b,layersFor(s,userId,b).filter(l=>!layers||layers.includes(l))] as const));
 const anyAllows=(l:Layer)=>[...allowedIn.values()].some(a=>a.includes(l));
 const topics=TOPICS.filter(words=>words.some(w=>hasWord(question,w)));
 if(!(['building','firm','legal'] as const).some(anyAllows)||!topics.length)return noGrounding();
 const hits:Hit[]=[];
 for(const [buildingId,allowed] of allowedIn){
  if(!allowed.includes('building'))continue;
  const docs=visibleDocuments(s,userId,buildingId);
  for(const c of s.chunks.filter(c=>c.buildingId===buildingId)){
   const doc=docs.find(d=>d.id===c.documentId);
   if(!doc)continue;
   hits.push({kind:'building',title:String(doc.title),content:c.content,sectionRef:c.sectionRef,effectiveDate:doc.effective_date?String(doc.effective_date):null,buildingId,citation:null,firmName:null,haystack:(c.content+' '+String(doc.title)).toLowerCase()});
  }
 }
 if(anyAllows('legal'))for(const c of s.legalChunks)hits.push({kind:'legal',title:c.title,content:c.content,sectionRef:c.sectionRef,effectiveDate:null,buildingId:null,citation:c.citation,firmName:null,haystack:(c.content+' '+c.title).toLowerCase()});
 // The firm layer comes only from the firm each building is linked to, and each firm is searched once.
 const firmIds=[...new Set([...allowedIn].filter(([,a])=>a.includes('firm')).map(([b])=>linkedFirmId(s,b)).filter((f):f is string=>f!=null))];
 for(const firmId of firmIds){
  const firmName=String(s.organizations.find(o=>o.id===firmId)?.name??'Your firm');
  for(const c of s.firmChunks.filter(c=>c.orgId===firmId)){
   const doc=s.firmDocs.find(d=>d.id===c.docId);
   if(!doc)continue;
   const collection=FIRM_COLLECTIONS.find(x=>x.id===doc.collection)?.label??'Firm knowledge';
   hits.push({kind:'firm',title:doc.title,content:c.content,sectionRef:c.sectionRef,effectiveDate:null,buildingId:null,citation:firmName+' · '+collection+' · internal practice',firmName,haystack:(c.content+' '+doc.title).toLowerCase()});
  }
 }
 // Rank by how many of the question's topics a passage covers, then by how many of those topics' words it
 // uses; ties keep seed order.
 const score=(h:Hit)=>{const covered=topics.filter(t=>matches(h.haystack,t));return covered.length?covered.length*100+covered.flat().filter(w=>h.haystack.includes(w)).length:0;};
 const best=(list:Hit[],n:number)=>list.map(h=>({h,n:score(h)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,n).map(x=>x.h);
 const ofKind=(kind:Layer)=>hits.filter(h=>h.kind===kind);
 let picked:Hit[];
 if(buildingIds.length<2)picked=(['building','legal','firm'] as const).flatMap(kind=>best(ofKind(kind),PER_LAYER));
 else{
  // Portfolio: the best passage from each building, then one from the law and one from the firm — still
  // within `answerSchema`'s six answer claims.
  const legal=best(ofKind('legal'),1),firm=best(ofKind('firm'),1);
  const own=best(buildingIds.flatMap(b=>best(ofKind('building').filter(h=>h.buildingId===b),1)),MAX_CLAIMS-legal.length-firm.length);
  picked=[...own,...legal,...firm];
 }
 if(!picked.length)return noGrounding();
 const sources:Source[]=picked.map((h,i)=>({id:i+1,chunkId:newId(),kind:h.kind,title:h.title,content:h.content,sectionRef:h.sectionRef,effectiveDate:h.effectiveDate,buildingId:h.buildingId,page:null,citation:h.citation,...(h.firmName?{firmName:h.firmName}:{})}));
 const cite=(text:string,ids:number[])=>({text:PREFIX+' '+text,evidence:ids.map(id=>({source:id,quote:sources.find(x=>x.id===id)!.content}))});
 const answerClaims=sources.map(src=>cite(src.content,[src.id]));
 const own=sources.filter(x=>x.kind==='building');
 // A basis claim cites one building only, so every claim stays under a single building's heading.
 const ownBuildings=[...new Set(own.map(x=>x.buildingId))];
 const basis=ownBuildings.map(b=>cite(ownBuildings.length>1?'This passage comes from this building’s own uploaded documents, quoted below. Only a building’s own bylaws bind its owners.':'This passage comes from the building’s own uploaded documents, quoted below. Only the building’s bylaws bind its owners.',own.filter(x=>x.buildingId===b).map(x=>x.id))).slice(0,6);
 const nextSteps=[cite('Open the source to read the full provision before relying on it.',[(own[0]??sources[0]).id])];
 let limitations=PREFIX+' No real building documents or live legal sources were searched.';
 // An amount in a firm or legal passage that differs from a building's own amount on the same topic.
 search:for(const other of sources.filter(x=>x.kind!=='building')){
  for(const mineSource of own){
   const mine=amounts(mineSource.content,topics);
   const clash=amounts(other.content,topics).flatMap(a=>mine.filter(b=>b.value!==a.value&&a.subjects.some(i=>b.subjects.includes(i))).map(b=>[a.value,b.value] as const))[0];
   if(!clash)continue;
   const building=s.buildings.find(b=>b.id===mineSource.buildingId);
   const who=other.kind==='firm'?possessive(other.firmName??'The firm')+' internal guidance':'A legal source';
   limitations+=' Conflict: '+who+' says $'+clash[0]+', but '+possessive(building?.name??'this building')+' bylaws set $'+clash[1]+' on this point. The building’s bylaw governs, within the limits the Act allows.';
   break search;
  }
 }
 return {answer:{answer:answerClaims,basis,nextSteps,limitations},sources};
}
