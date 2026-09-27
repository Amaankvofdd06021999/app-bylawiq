'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Reply} from 'lucide-react';
import {Badge,Button,PageHeading} from '@/components/ui';
import {useBackend} from '@/components/backend';
import type {ResidentData} from '../types';
import {LegalBanner} from './legal-banner';
import {PaywallDialog,useDraftTool} from './paywall-dialog';
import {DraftView} from './my-drafts';
import {ToolPaused} from './draft-notice';
import {creditWord} from './credits-card';
/** Reply to a strata letter (3 credits): paste the letter → what it means against your bylaws and the law, and a
 * draft reply, saved privately to My drafts. */
export function ReplyLetter({data}:{data:ResidentData}){
 const {base}=useBackend();const tool=useDraftTool();const price=data.prices.letterReply;
 const[letter,setLetter]=useState(''),[response,setResponse]=useState('');
 const heading=<PageHeading eyebrow={data.building.name.toUpperCase()} title="Reply to a strata letter" description="Paste a letter from council or your strata manager. We’ll explain it and draft a reply." action={<Badge tone="ai">{creditWord(price)}</Badge>}/>;
 if(!data.aiOn)return <>{heading}<ToolPaused/></>;
 return <>
  {heading}
  <LegalBanner/>
  <div className="split-grid dash-split tool-layout">
   <form className="card form-stack" aria-label="Letter details" onSubmit={e=>{e.preventDefault();void tool.submit({kind:'letter_reply',buildingId:data.building.id,letter,response});}}>
    <label>The letter you received<textarea value={letter} onChange={e=>setLetter(e.target.value)} required minLength={20} maxLength={8000} rows={9} placeholder="Paste the full text of the letter."/></label>
    <label>Your side (optional)<textarea value={response} onChange={e=>setResponse(e.target.value)} maxLength={2000} rows={4} placeholder="What you want council to know. Leave blank to fill in later."/></label>
    <p className="form-note">Uses {creditWord(price)} from your balance of {data.wallet.credits}. If the letter doesn’t match anything in your building’s owner documents, nothing is charged.</p>
    {tool.error&&<p className="form-error" role="alert">{tool.error}</p>}
    <div className="form-footer"><Button type="submit" busy={tool.busy}><Reply size={15} aria-hidden/>Explain and draft a reply · {creditWord(price)}</Button></div>
   </form>
   <div aria-live="polite">{tool.busy?<div className="loading-skeleton" role="status" aria-label="Reading your letter"/>:tool.draft?<><p className="success-note" role="status">Saved to <Link href={`${base}/b/${data.building.id}/my-drafts`}>My drafts</Link>. Add your side and check every detail before you send it.</p><DraftView draft={tool.draft}/></>
    :<div className="card"><h2 className="card-heading">What you’ll get</h2><ul className="plain-bullets"><li>What this letter means, point by point, against your building’s bylaws</li><li>Any amount or deadline in the letter worth checking</li><li>What the Strata Property Act says about the process</li><li>A polite draft reply, saved privately in My drafts</li></ul></div>}</div>
  </div>
  <PaywallDialog open={tool.paywall} onOpenChange={v=>{if(!v)tool.closePaywall();}} buildingId={data.building.id} needed={price} credits={data.wallet.credits} pack={data.prices.pack} onBought={tool.retry}/>
 </>;
}
