import type {MockState} from './store';
import {newId} from './store';
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
/** Mirrors `features/chat/retrieval.ts` + the answer half of `features/chat/stream.ts#generateAnswer`, but as
 * a pure keyword match instead of an embedding search and model call. `buildingId` scopes the chunk search
 * exactly the way Postgres RLS scopes the real retrieval — a chunk from any other building is never a
 * candidate, so it can never be cited (AGENTS.md §0). */
export function answer(s:MockState,_userId:string,buildingId:string,question:string):AnswerData{
 const topic=TOPICS.find(words=>words.some(w=>hasWord(question,w)));
 const chunks=s.chunks.filter(c=>c.buildingId===buildingId);
 const matched=topic?chunks.filter(c=>{
  const doc=s.documents.find(d=>d.id===c.documentId);
  const haystack=(c.content+' '+(doc?String(doc.title):'')).toLowerCase();
  return topic.some(w=>haystack.includes(w));
 }):[];
 if(!matched.length)return noGrounding();
 const picked=matched.slice(0,3);
 const sources:Source[]=picked.map((c,i)=>{
  const doc=s.documents.find(d=>d.id===c.documentId);
  return {id:i+1,chunkId:newId(),kind:'building',title:doc?String(doc.title):'Building document',content:c.content,sectionRef:c.sectionRef,effectiveDate:doc?.effective_date?String(doc.effective_date):null,buildingId,page:null,citation:null};
 });
 const cite=(text:string,ids:number[])=>({text:PREFIX+' '+text,evidence:ids.map(id=>({source:id,quote:sources.find(x=>x.id===id)!.content}))});
 const answerClaims=sources.map(src=>cite(src.content,[src.id]));
 const basis=[cite('This passage comes from the building’s own uploaded documents, quoted below.',sources.map(src=>src.id))];
 const nextSteps=[cite('Open the source to read the full provision before relying on it.',[sources[0].id])];
 const limitations=PREFIX+' No real building documents or live legal sources were searched.';
 return {answer:{answer:answerClaims,basis,nextSteps,limitations},sources};
}
