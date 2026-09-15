import 'server-only';
import {Redis} from '@upstash/redis';
import {Ratelimit} from '@upstash/ratelimit';
import {RateLimitError} from '@/lib/errors';
import {secret} from '@/lib/env';
import {db} from '@/lib/supabase/server';
import {createHmac} from 'node:crypto';
import {checkDb} from '@/lib/errors';
export async function rateLimit(id:string,kind:'chat'|'upload'|'auth'='chat'){
 if(!process.env.UPSTASH_REDIS_REST_URL){
  const client=await db();const key=kind+':'+id;const limit=kind==='upload'?50:kind==='auth'?10:30;const window=kind==='upload'?3600:kind==='auth'?900:60;
  const signature=createHmac('sha256',secret('SERVER_SIGNING_SECRET')).update(key+':'+limit+':'+window).digest('hex');
  const {data,error}=await client.rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_window:window,p_signature:signature});checkDb(error);if(data!==true)throw new RateLimitError();return;
 }
 const redis=new Redis({url:secret('UPSTASH_REDIS_REST_URL'),token:secret('UPSTASH_REDIS_REST_TOKEN')});
 const limiter=new Ratelimit({redis,limiter:Ratelimit.slidingWindow(kind==='upload'?50:kind==='auth'?10:30,kind==='upload'?'1 h':kind==='auth'?'15 m':'1 m'),prefix:'bylawiq:'+kind,analytics:false});
 if(!(await limiter.limit(id)).success)throw new RateLimitError();
}
