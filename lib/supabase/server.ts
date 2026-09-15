import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {publicEnv} from '@/lib/env';
export async function db(){const jar=await cookies();const env=publicEnv();return createServerClient(env.url,env.key,{cookies:{getAll:()=>jar.getAll(),setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Read-only RSC. Proxy refreshes cookies before rendering. */}}}});}
