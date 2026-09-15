import {describe,it,expect} from 'vitest';
import {structuralChunks} from '@/lib/ai/chunking';
import {validateCitations,type GroundedAnswer,type Source} from '@/lib/ai/citations';
import {allowedUrl,publicAddress} from '@/lib/security/web-source';
import {checkDb,AppError} from '@/lib/errors';
describe('database error mapping',()=>{
 it('reports an existing member as a conflict, not a failed save',()=>{
  let thrown:unknown;try{checkDb({message:'already_member'});}catch(e){thrown=e;}
  expect(thrown).toBeInstanceOf(AppError);expect((thrown as AppError).code).toBe('already_member');expect((thrown as AppError).status).toBe(409);
 });
});
const source:Source={id:1,chunkId:'10000000-0000-4000-8000-000000000001',kind:'building',title:'Sample bylaws',content:'The shared garden closes at 8 pm. Visitors must leave through the south gate.',sectionRef:'3.1',effectiveDate:'2026-01-01',buildingId:'20000000-0000-4000-8000-000000000001',page:1,citation:null};
const answer:GroundedAnswer={answer:[{text:'The garden closes at 8 pm.',evidence:[{source:1,quote:'The shared garden closes at 8 pm.'}]}],basis:[],nextSteps:[],limitations:''};
describe('citation guard',()=>{
 it('resolves an exact quoted passage',()=>expect(validateCitations(answer,[source])).toBe(true));
 it('rejects a invented source number',()=>expect(validateCitations({...answer,answer:[{...answer.answer[0],evidence:[{source:9,quote:source.content}]}]},[source])).toBe(false));
 it('rejects a fabricated quotation',()=>expect(validateCitations({...answer,answer:[{...answer.answer[0],evidence:[{source:1,quote:'The garden closes at 10 pm.'}]}]},[source])).toBe(false));
 it('rejects a fabricated statutory provision',()=>expect(validateCitations({...answer,answer:[{...answer.answer[0],text:'Section 999 permits a fine.'}]},[source])).toBe(false));
 it('rejects an invented Code-suffixed authority',()=>expect(validateCitations({...answer,answer:[{...answer.answer[0],text:'The Residential Conduct Code permits this.'}]},[source])).toBe(false));
});
describe('structural chunks',()=>{it('keeps headingless numbered sections',()=>{const chunks=structuralChunks('124 Existing provision\nBody.\n125 An owner may set a garden schedule.\n126 Next provision');expect(chunks.some(c=>c.sectionRef==='125'&&c.content.includes('garden'))).toBe(true);});it('does not discard an unheaded introduction',()=>expect(structuralChunks('An unheaded paragraph of source text.')[0].content).toContain('unheaded'));});
describe('website source protection',()=>{
 for(const url of ['http://example.com','https://127.0.0.1','https://[::1]','https://example.com:8080','https://user:pass@example.com','https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_00','https://www.canlii.org/en/bc/'])it('rejects '+url,()=>expect(()=>allowedUrl(url)).toThrow());
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1'])it('rejects nonpublic address '+ip,()=>expect(publicAddress(ip)).toBe(false));
 it('allows a public DNS IP',()=>expect(publicAddress('93.184.216.34')).toBe(true));
});
