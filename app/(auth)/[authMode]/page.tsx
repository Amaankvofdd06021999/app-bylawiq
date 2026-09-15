import {notFound} from 'next/navigation';
import {AuthForm} from '@/features/auth/components/auth-form';
import {configured} from '@/lib/env';
export default async function AuthPage({params}:{params:Promise<{authMode:string}>}){const {authMode}=await params;if(authMode!=='login'&&authMode!=='signup'&&authMode!=='forgot'&&authMode!=='reset')notFound();return <AuthForm mode={authMode} ready={configured()}/>;}
