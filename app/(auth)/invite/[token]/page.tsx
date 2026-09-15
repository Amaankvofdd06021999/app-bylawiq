import {InviteForm} from '@/features/auth/components/auth-form';
export default async function Invite({params}:{params:Promise<{token:string}>}){const {token}=await params;return <InviteForm token={token}/>;}
