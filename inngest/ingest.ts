import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {PDFParse} from 'pdf-parse';
import mammoth from 'mammoth';
import {adminDb} from '@/lib/supabase/admin';
import {embeddings} from '@/lib/ai/embeddings';
import {structuralChunks,contextualText} from '@/lib/ai/chunking';
import {scrapePage} from '@/lib/security/web-source';
import {checkDb,AppError} from '@/lib/errors';
import {inngest} from './client';
const eventSchema=z.object({documentId:z.uuid(),buildingId:z.uuid(),actorId:z.uuid()});
export const ingestDocument=inngest.createFunction({id:'ingest-document',retries:3,concurrency:{limit:1,key:'event.data.documentId'}},{event:'document/ingest'},async({event,step})=>{
 const v=eventSchema.parse(event.data);const db=adminDb();
 const document=await step.run('authorize-job',async()=>{
  const {data:member,error:me}=await db.from('building_members').select('role,status,expires_at').eq('building_id',v.buildingId).eq('user_id',v.actorId).single();checkDb(me);if(!member)throw new AppError('forbidden','Membership unavailable.');if(member.status!=='active'||(member.expires_at&&new Date(member.expires_at)<=new Date()))throw new AppError('forbidden','Ingestion authorization has expired.');const {data:permission,error:pe}=await db.from('role_permissions').select('permission').eq('role',member.role).eq('permission','vault.upload');checkDb(pe);if(!permission?.length)throw new AppError('forbidden','Ingestion authorization has expired.');
  const {data,error}=await db.from('documents').select('id,building_id,title,type,status,storage_path,source_url,effective_date,deleted_at').eq('id',v.documentId).eq('building_id',v.buildingId).single();checkDb(error);if(!data)throw new AppError('not_found','Document unavailable.');if(data.deleted_at)throw new AppError('document_archived','This document has been archived.');return z.object({id:z.string(),building_id:z.string(),title:z.string(),type:z.string(),status:z.string(),storage_path:z.string().nullable(),source_url:z.string().nullable(),effective_date:z.string().nullable()}).parse(data);
 });
 if(document.status==='ready'||document.status==='review')return {alreadyIndexed:true};
 async function status(value:string,errorMessage:string|null=null){const result=await db.from('documents').update({status:value,error_message:errorMessage}).eq('id',document.id).is('deleted_at',null);checkDb(result.error);}
 try{
 const parsed=await step.run('scan-and-parse',async()=>{
  await status('parsing');if(document.source_url)return scrapePage(document.source_url);
  if(!document.storage_path)throw new AppError('file_missing','The uploaded file is unavailable.');const {data,error}=await db.storage.from('vault').download(document.storage_path);checkDb(error);if(!data)throw new AppError('file_missing','The uploaded file is unavailable.');const bytes=Buffer.from(await data.arrayBuffer());
  if(process.env.NODE_ENV==='production'||process.env.FILE_SCAN_URL){await status('scanning');if(!process.env.FILE_SCAN_URL||!process.env.FILE_SCAN_TOKEN)throw new AppError('scanner_unavailable','The malware scanner must be connected before this file can be processed.');const scanned=await fetch(process.env.FILE_SCAN_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.FILE_SCAN_TOKEN,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(60000)});const verdict=z.object({clean:z.boolean()}).parse(await scanned.json());if(!scanned.ok||!verdict.clean)throw new AppError('scan_failed','This file did not pass the malware scan.');}
  // Storage only serves a vault file once this is set (clean scan, or scanning disabled outside production).
  checkDb((await db.from('documents').update({scan_cleared_at:new Date().toISOString()}).eq('id',document.id).is('deleted_at',null)).error);
  await status('parsing');const ext=document.storage_path.split('.').pop();if(ext==='txt'||ext==='md')return bytes.toString('utf8');if(ext==='docx')return (await mammoth.extractRawText({buffer:bytes})).value;
  const parser=new PDFParse({data:new Uint8Array(bytes)});try{const parsed=await parser.getText();if(parsed.text.trim().length<100)throw new AppError('ocr_required','This PDF needs OCR. Upload a searchable PDF or connect the OCR integration.');return parsed.text;}finally{await parser.destroy();}
 });
 const sections=await step.run('detect-structure',async()=>{await status('chunking');const chunks=structuralChunks(parsed);if(!chunks.length)throw new AppError('empty_document','No readable text was found.');if(chunks.length>2000)throw new AppError('document_too_large','Split this document into smaller files.');return chunks;});
 await step.run('clear-retry-chunks',async()=>{checkDb((await db.from('document_chunks').delete().eq('document_id',document.id).eq('building_id',v.buildingId)).error);await status('embedding');});
 for(let i=0;i<sections.length;i+=64){await step.run('embed-batch-'+i,async()=>{const slice=sections.slice(i,i+64);const vectors=await embeddings(slice.map(s=>contextualText(document.title,document.effective_date,s)),'document');const {error}=await db.from('document_chunks').upsert(slice.map((s,j)=>({document_id:document.id,building_id:v.buildingId,chunk_index:i+j,content:s.content,heading:s.heading,section_ref:s.sectionRef,page_from:s.page,effective_date:document.effective_date,embedding:JSON.stringify(vectors[j])})),{onConflict:'document_id,chunk_index'});checkDb(error);});}
 await step.run('finish',async()=>{const hash=createHash('sha256').update(parsed).digest('hex');checkDb((await db.from('document_versions').upsert({document_id:document.id,building_id:v.buildingId,content_hash:hash,storage_path:document.storage_path},{onConflict:'document_id,content_hash'})).error);checkDb((await db.from('documents').update({status:'review',content_hash:hash,parsed_sections:sections,error_message:null}).eq('id',document.id).is('deleted_at',null)).error);});return {sections:sections.length,status:'review'};
 }catch(e){await status('failed',e instanceof AppError?e.message:'Indexing could not complete. Retry the upload or contact your administrator.');throw new Error('Document ingestion failed: '+v.documentId);}
});
