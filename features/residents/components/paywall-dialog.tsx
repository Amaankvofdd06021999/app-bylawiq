'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Coins} from 'lucide-react';
import {Button,Modal} from '@/components/ui';
import {useBackend} from '@/components/backend';
import type {DraftInput,Prices,ResidentDraftView} from '../types';
/** Shown when a paid tool costs more credits than the resident has. Buying here runs the same demo checkout as
 * the Credits page, then `onBought` carries on with what the resident was doing — one click, no retyping. */
export function PaywallDialog({open,onOpenChange,buildingId,needed,credits,pack,onBought}:{open:boolean;onOpenChange:(v:boolean)=>void;buildingId:string;needed:number;credits:number;pack:Prices['pack'];onBought:()=>void}){
 const backend=useBackend();const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function buy(){setBusy(true);setError('');const r=await backend.buyCredits({buildingId});setBusy(false);if(!r.ok){setError(r.error);return;}onOpenChange(false);onBought();}
 return <Modal open={open} onOpenChange={onOpenChange} title="You need more credits" description="Nothing was charged and nothing was saved.">
  <div className="form-stack">
   <p className="form-note">This uses {needed} credits and you have {credits}. Buy {pack.credits} credits for ${pack.price} and we’ll carry on straight away.</p>
   <p className="checkout-line"><Coins size={16} aria-hidden/><span>{pack.credits} credits</span><strong>${pack.price}.00</strong></p>
   <p className="form-note"><strong>Demo — no real charge.</strong> No card is asked for or charged.</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="form-footer"><Button variant="secondary" onClick={()=>onOpenChange(false)}>Not now</Button><Button busy={busy} onClick={buy}>Buy {pack.credits} credits · ${pack.price} and continue</Button></div>
  </div>
 </Modal>;
}
/** Runs a paid drafting tool: submit, show the paywall when credits run short, and resubmit the same input once
 * the resident has bought credits. */
export function useDraftTool(){
 const router=useRouter(),backend=useBackend();
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<ResidentDraftView|null>(null),[paywall,setPaywall]=useState<DraftInput|null>(null);
 async function submit(input:DraftInput){
  setBusy(true);setError('');
  const r=await backend.residentDraft(input);setBusy(false);
  if(r.ok){setDraft(r.draft);router.refresh();return;}
  if(r.paywall){setPaywall(input);return;}
  setError(r.error);
 }
 return {busy,error,draft,setDraft,submit,paywall:paywall!=null,closePaywall:()=>setPaywall(null),retry:()=>{const input=paywall;setPaywall(null);router.refresh();if(input)void submit(input);}};
}
