import {redirect} from 'next/navigation';
import {workspace} from '@/features/workspace/queries';
import {configured} from '@/lib/env';
import {Onboarding} from '@/features/auth/components/auth-form';
import {UnauthorizedError} from '@/lib/errors';
import {Shell} from '@/components/shell';
import {Portfolio} from '@/features/workspace/components/portfolio';
export const dynamic='force-dynamic';
export default async function WorkspacePage(){if(!configured())redirect('/login');const state=await workspace().catch(e=>{if(e instanceof UnauthorizedError)redirect('/login');throw e;});if(!state.profile.account_type)return <Onboarding/>;if(state.profile.account_type==='single_building'&&state.buildings[0])redirect('/b/'+state.buildings[0].id+'/ask');return <Shell profile={state.profile} buildings={state.buildings}><Portfolio {...state}/></Shell>;}
