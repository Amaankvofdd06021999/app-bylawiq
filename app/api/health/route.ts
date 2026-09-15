import {configured} from '@/lib/env';
export async function GET(){return Response.json({application:'bylawiq',status:configured()?'configured':'setup_required'},{headers:{'Cache-Control':'no-store'}});}
