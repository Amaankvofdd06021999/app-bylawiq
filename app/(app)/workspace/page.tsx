import {redirect} from 'next/navigation';
import {workspace} from '@/features/workspace/queries';
import {firmOrganizations,firmReviewInbox} from '@/features/firm-links/queries';
import {configured} from '@/lib/env';
import {Onboarding} from '@/features/auth/components/auth-form';
import {UnauthorizedError} from '@/lib/errors';
import {Shell} from '@/components/shell';
import {Portfolio} from '@/features/workspace/components/portfolio';
import {JoinBuildingForm} from '@/features/firm-links/components/join-building-form';
import {ReviewInbox} from '@/features/firm-links/components/review-inbox';
export const dynamic='force-dynamic';
export default async function WorkspacePage({searchParams}:{searchParams:Promise<{notice?:string;code?:string}>}){if(!configured())redirect('/login');const {notice,code}=await searchParams;const state=await workspace().catch(e=>{if(e instanceof UnauthorizedError)redirect('/login');throw e;});if(!state.profile.account_type)return <Onboarding/>;if(state.profile.account_type==='single_building'&&state.buildings[0]&&notice!=='access_removed')redirect('/b/'+state.buildings[0].id+'/ask');const [firms,inbox]=await Promise.all([firmOrganizations(),firmReviewInbox()]);
 return <Shell profile={state.profile} buildings={state.buildings}>{notice==='access_removed'&&<p role="status" className="card" style={{marginBottom:20}}>You no longer have access to that building, or it doesn’t exist.</p>}<Portfolio {...state}/>{firms.length>0&&<><div style={{marginTop:32}}><JoinBuildingForm firms={firms} initialCode={code||''}/></div><ReviewInbox items={inbox} buildings={state.buildings}/></>}</Shell>;}
