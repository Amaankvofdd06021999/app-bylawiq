import {exportArtifact} from '@/mock/api';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return exportArtifact(req,await params);}
