import {z} from 'zod';
export const sourceSchema=z.object({id:z.number().int().positive(),chunkId:z.uuid(),kind:z.enum(['building','legal']),title:z.string(),content:z.string(),sectionRef:z.string().nullable(),effectiveDate:z.string().nullable(),buildingId:z.uuid().nullable(),page:z.number().nullable(),citation:z.string().nullable()});
export type Source=z.infer<typeof sourceSchema>;
const claim=z.object({text:z.string().min(1).max(2000),evidence:z.array(z.object({source:z.number().int().positive(),quote:z.string().min(10).max(1200)})).min(1).max(5)});
export const answerSchema=z.object({answer:z.array(claim).min(1).max(6),basis:z.array(claim).max(6),nextSteps:z.array(claim).max(5),limitations:z.string().max(600)});
export type GroundedAnswer=z.infer<typeof answerSchema>;
/** Reject fabricated authority names/section numbers before the answer enters a UI stream.
 * This validates resolvability and exact evidence spans, not legal entailment; human review remains mandatory.
 */
export function validateCitations(answer:GroundedAnswer,sources:Source[]):boolean{
 const legalTokens=(s:string)=>[...s.matchAll(/\b(?:[Ss](?:ection)?s?\.?\s*\d+(?:\.\d+)*(?:\([\da-z]+\))*|\d{4}\s+(?:BCCRT|BCSC|BCCA|BCHRT)\s+\d+|[A-Z][A-Za-z]*(?:\s+(?:[A-Z][A-Za-z]*|of|the|and|to)){0,10}\s+(?:Act|Code|Regulation|Rules))\b/g)].map(m=>m[0].toLowerCase().replace(/\s+/g,' '));
 return [...answer.answer,...answer.basis,...answer.nextSteps].every(c=>{
  const used=c.evidence.map(e=>sources.find(s=>s.id===e.source));
  if(c.evidence.some((e,i)=>!used[i]||!used[i]!.content.includes(e.quote)))return false;
  const text=used.map(s=>s!.content+' '+s!.title+' '+s!.citation+' '+s!.sectionRef).join(' ').toLowerCase().replace(/\s+/g,' ');
  return legalTokens(c.text).every(token=>text.includes(token));
 }) && legalTokens(answer.limitations).length===0;
}
export const NO_GROUNDING='I couldn’t find enough verified source material to answer this question. Upload the current registered bylaws, confirm their structure, or narrow the question to a provision in your vault. No legal conclusion has been generated.';
