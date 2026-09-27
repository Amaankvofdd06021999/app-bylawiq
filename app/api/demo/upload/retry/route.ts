import {uploadRetry} from '@/mock/api';
export async function POST(req:Request){return uploadRetry(req);}
