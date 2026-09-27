import {chatStream} from '@/mock/api';
export const runtime='nodejs';export const maxDuration=300;export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return chatStream(req,await params);}
