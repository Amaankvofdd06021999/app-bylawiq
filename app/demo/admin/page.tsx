import {redirect} from 'next/navigation';
import {demoSession} from '@/mock/session';
import {getStore} from '@/mock/store';
import {landingPath} from '@/mock/personas';
import {isPlatformAdmin} from '@/mock/rules';
import {platformDashboard} from '@/mock/dashboards';
import {PlatformAdminDashboard,PlatformFrame} from '@/features/dashboards/components/platform-admin';
export const dynamic='force-dynamic';
export const metadata={title:'Platform overview'};
// The BylawIQ platform admin's home: aggregates across every customer, outside any building. Anyone else is sent
// to their own home.
export default async function DemoAdminPage(){const session=await demoSession();if(!session)redirect('/demo');const s=getStore(session.sessionId),userId=session.persona.userId;if(!isPlatformAdmin(s,userId))redirect(landingPath(session.persona,s));
 return <PlatformFrame name={session.persona.name}><PlatformAdminDashboard data={platformDashboard(s,userId)}/></PlatformFrame>;}
