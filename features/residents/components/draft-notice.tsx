'use client';
import {useState} from 'react';
import Link from 'next/link';
import {FilePen,PauseCircle} from 'lucide-react';
import {Badge,Button,Empty,PageHeading} from '@/components/ui';
import {useBackend} from '@/components/backend';
import type {ResidentData} from '../types';
import {LegalBanner} from './legal-banner';
import {PaywallDialog,useDraftTool} from './paywall-dialog';
import {DraftView} from './my-drafts';
import {creditWord} from './credits-card';
/** Shown instead of a paid tool while the platform has resident AI turned off. */
export function ToolPaused(){return <Empty icon={<PauseCircle/>} title="This tool is paused" description="BylawIQ has paused AI help for residents. Your credits and saved drafts are safe."/>;}
/** Draft a notice to council (5 credits): topic, what happened and what you want → a letter that quotes the
 * owner-visible bylaws it relies on, saved privately to My drafts. */
export function DraftNotice({data}:{data:ResidentData}){
 const {base}=useBackend();const tool=useDraftTool();const price=data.prices.draftNotice;
 const[topic,setTopic]=useState(''),[happened,setHappened]=useState(''),[request,setRequest]=useState('');
 const heading=<PageHeading eyebrow={data.building.name.toUpperCase()} title="Draft a notice to council" description="Tell us what happened. We’ll write a clear letter that quotes your building’s bylaws." action={<Badge tone="ai">{creditWord(price)}</Badge>}/>;
 if(!data.aiOn)return <>{heading}<ToolPaused/></>;
 return <>
  {heading}
  <LegalBanner/>
  <div className="split-grid dash-split tool-layout">
   <form className="card form-stack" aria-label="Notice details" onSubmit={e=>{e.preventDefault();void tool.submit({kind:'notice_to_council',buildingId:data.building.id,topic,happened,request});}}>
    <label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} required minLength={3} maxLength={120} placeholder="For example, weekend renovation noise"/></label>
    <label>What happened<textarea value={happened} onChange={e=>setHappened(e.target.value)} required minLength={10} maxLength={2000} rows={5} placeholder="Dates, times and what you saw or heard."/></label>
    <label>What you want council to do<textarea value={request} onChange={e=>setRequest(e.target.value)} required minLength={5} maxLength={1000} rows={3} placeholder="For example, remind the owner of the quiet hours."/></label>
    <p className="form-note">Uses {creditWord(price)} from your balance of {data.wallet.credits}. Free questions don’t apply to drafting. If no bylaw matches, nothing is charged.</p>
    {tool.error&&<p className="form-error" role="alert">{tool.error}</p>}
    <div className="form-footer"><Button type="submit" busy={tool.busy}><FilePen size={15} aria-hidden/>Draft my notice · {creditWord(price)}</Button></div>
   </form>
   <div aria-live="polite">{tool.busy?<div className="loading-skeleton" role="status" aria-label="Drafting your notice"/>:tool.draft?<><p className="success-note" role="status">Saved to <Link href={`${base}/b/${data.building.id}/my-drafts`}>My drafts</Link>. Read it through and change anything before you send it.</p><DraftView draft={tool.draft}/></>
    :<div className="card"><h2 className="card-heading">What you’ll get</h2><ul className="plain-bullets"><li>A letter to council in plain language</li><li>The exact words of the bylaws it relies on, from your building’s owner documents</li><li>Your name and unit number in the sign-off</li><li>A private copy in My drafts to copy or download</li></ul></div>}</div>
  </div>
  <PaywallDialog open={tool.paywall} onOpenChange={v=>{if(!v)tool.closePaywall();}} buildingId={data.building.id} needed={price} credits={data.wallet.credits} pack={data.prices.pack} onBought={tool.retry}/>
 </>;
}
