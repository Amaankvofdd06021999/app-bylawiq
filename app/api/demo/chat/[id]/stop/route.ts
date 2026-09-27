import {chatStop} from '@/mock/api';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return chatStop(req,await params);}
