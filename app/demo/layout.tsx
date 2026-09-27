import {notFound} from 'next/navigation';
import {demoEnabled} from '@/lib/env';
import {BackendProvider} from '@/components/backend';
import {DemoBanner} from '@/mock/components/demo-banner';
import {mutateAction,createFirmCodeAction,revokeFirmLinkAction,acceptFirmCodeAction,createChatAction,branchChatAction,signOutAction,setResidentAiAction,buyCreditsAction,residentDraftAction,saveFirmDocAction,deleteFirmDocAction} from '@/mock/actions';
// The gate reads DEMO_MODE per request, so nothing under /demo is prerendered with the build's value baked in.
export const dynamic='force-dynamic';
// Every /demo page renders inside this layout, so the gate here covers them all (route handlers gate themselves).
export default function DemoLayout({children}:{children:React.ReactNode}){if(!demoEnabled())notFound();
 return <BackendProvider value={{base:'/demo',api:'/api/demo',mutate:mutateAction,createFirmCode:createFirmCodeAction,revokeFirmLink:revokeFirmLinkAction,acceptFirmCode:acceptFirmCodeAction,createChat:createChatAction,branchChat:branchChatAction,signOut:signOutAction,setFlag:setResidentAiAction,buyCredits:buyCreditsAction,residentDraft:residentDraftAction,saveFirmDoc:saveFirmDocAction,deleteFirmDoc:deleteFirmDocAction}}><DemoBanner/>{children}</BackendProvider>;}
