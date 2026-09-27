import {redirect} from 'next/navigation';
import {demoSession} from '@/mock/session';
import {getStore} from '@/mock/store';
import {landingPath} from '@/mock/personas';
import {workspace,firmOrganizations,firmReviewInbox} from '@/mock/source';
import {Shell} from '@/components/shell';
import {Portfolio} from '@/features/workspace/components/portfolio';
import {JoinBuildingForm} from '@/features/firm-links/components/join-building-form';
import {ReviewInbox} from '@/features/firm-links/components/review-inbox';
export const dynamic='force-dynamic';
// Mirrors app/(app)/workspace/page.tsx, reading the demo session's store as its person. Every demo person has an account type, so there is no onboarding step.
export default async function DemoWorkspacePage({searchParams}:{searchParams:Promise<{notice?:string;code?:string}>}){const session=await demoSession();if(!session)redirect('/demo');const {notice,code}=await searchParams;const s=getStore(session.sessionId),userId=session.persona.userId;const state=workspace(s,userId);if(state.profile.account_type==='single_building'&&state.buildings[0]&&notice!=='access_removed')redirect(landingPath(session.persona,s));const firms=firmOrganizations(s,userId),inbox=firmReviewInbox(s,userId);
 return <Shell profile={state.profile} buildings={state.buildings}>{notice==='access_removed'&&<p role="status" className="card" style={{marginBottom:20}}>You no longer have access to that building, or it doesn’t exist.</p>}<Portfolio {...state}/>{firms.length>0&&<><div style={{marginTop:32}}><JoinBuildingForm firms={firms} initialCode={code||''}/></div><ReviewInbox items={inbox} buildings={state.buildings} base="/demo"/></>}</Shell>;}
