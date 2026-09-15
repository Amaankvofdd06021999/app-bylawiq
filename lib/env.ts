import 'server-only';
import {z} from 'zod';
import {AppError} from './errors';
export function configured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);}
export function publicEnv(){
 const value=z.object({url:z.url(),key:z.string().min(1)}).safeParse({url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY});
 if(!value.success)throw new AppError('setup_required','The workspace connection is being configured.',503);
 if(process.env.VERCEL_ENV==='preview'&&(process.env.DATABASE_ENVIRONMENT!=='preview'||value.data.url===process.env.PRODUCTION_SUPABASE_URL))throw new AppError('environment_mismatch','Preview database configuration needs review.',503);
 if(process.env.VERCEL_ENV==='production'&&process.env.DATABASE_ENVIRONMENT!=='production')throw new AppError('environment_mismatch','Production database configuration needs review.',503);
 return value.data;
}
export function secret(name:string){const value=process.env[name];if(!value)throw new AppError('service_unconfigured','This service is not connected yet. Your work has been saved.',503);return value;}
export function appUrl(){return process.env.NEXT_PUBLIC_APP_URL||(process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000');}
