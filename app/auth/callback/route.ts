import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase/server';
export async function GET(req:Request){const url=new URL(req.url);const code=url.searchParams.get('code');const next=url.searchParams.get('next')==='/reset'?'/reset':'/workspace';if(code){const client=await db();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}return NextResponse.redirect(new URL('/login?error=verification',url.origin));}
