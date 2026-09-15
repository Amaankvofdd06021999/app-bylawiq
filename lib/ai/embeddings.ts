import 'server-only';
import {z} from 'zod';
import {secret} from '@/lib/env';
import {AppError} from '@/lib/errors';
import {MODEL_IDS} from './models';
export async function embeddings(texts:string[],type:'document'|'query'){
 const response=await fetch('https://api.voyageai.com/v1/embeddings',{method:'POST',headers:{Authorization:'Bearer '+secret('VOYAGE_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify({input:texts,model:MODEL_IDS.embedding,input_type:type,truncation:false}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new AppError('embedding_unavailable','Search indexing is temporarily unavailable.',503);
 const body=z.object({data:z.array(z.object({index:z.number(),embedding:z.array(z.number()).length(1024)}))}).parse(await response.json());
 if(body.data.length!==texts.length)throw new AppError('embedding_mismatch','The embedding service returned an incomplete batch.',503);
 return body.data.sort((a,b)=>a.index-b.index).map(d=>d.embedding);
}
