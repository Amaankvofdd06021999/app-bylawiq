'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Check,Copy,Download,FilePen,FolderOpen,Lock,Reply} from 'lucide-react';
import {Badge,Button,Empty,PageHeading} from '@/components/ui';
import {useBackend} from '@/components/backend';
import type {CitedPassage,ResidentData,ResidentDraftView} from '../types';
import {LegalBanner} from './legal-banner';
import {shortDate} from '@/lib/dates';
const KIND:Record<ResidentDraftView['kind'],string>={notice_to_council:'Notice to council',letter_reply:'Reply to a strata letter'};
function sourceLabel(p:CitedPassage):string{return p.kind==='legal'?(p.citation??p.title):`${p.title}${p.sectionRef?' · '+p.sectionRef:''}`;}
/** A saved draft: the letter text with copy and download, and the passages it cites. */
export function DraftView({draft,headingLevel=2}:{draft:ResidentDraftView;headingLevel?:2|3}){
 const[copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');const H=headingLevel===2?'h2':'h3';
 async function copy(){setCopyError('');try{await navigator.clipboard.writeText(draft.body);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopyError('Copy didn’t work here. Select the text and copy it instead.');}}
 function download(){const url=URL.createObjectURL(new Blob([draft.body],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=(draft.title.replace(/[^\w.-]+/g,'_')||'draft')+'.txt';a.click();URL.revokeObjectURL(url);}
 return <article className="card draft-card" aria-label={draft.title}>
  <div className="draft-card-top"><div><Badge tone="ai">{KIND[draft.kind]}</Badge><H className="draft-title">{draft.title}</H><p className="form-note inline-note"><Lock size={12} aria-hidden/>Private to you · saved {shortDate(draft.createdAt)}</p></div>
   <div className="action-line"><Button variant="secondary" size="small" onClick={copy}>{copied?<Check size={14} aria-hidden/>:<Copy size={14} aria-hidden/>}{copied?'Copied':'Copy'}</Button><Button variant="secondary" size="small" onClick={download}><Download size={14} aria-hidden/>Download</Button></div></div>
  {copyError&&<p className="form-error" role="alert">{copyError}</p>}
  {draft.meaning.length>0&&<section className="meaning"><h3>What this letter means</h3><ul>{draft.meaning.map((m,i)=><li key={i}>{m}</li>)}</ul></section>}
  <pre className="draft-output" tabIndex={0} aria-label="Draft text">{draft.body}</pre>
  {draft.sources.length>0&&<section className="draft-sources"><h3>Sources cited</h3><ul>{draft.sources.map((p,i)=><li key={i}><Badge tone={p.kind==='building'?'blue':'neutral'}>{p.kind==='building'?'Your building':'The law'}</Badge><span>{sourceLabel(p)}</span></li>)}</ul></section>}
 </article>;
}
export function MyDrafts({data}:{data:ResidentData}){
 const {base}=useBackend();const root=`${base}/b/${data.building.id}`;
 return <>
  <PageHeading eyebrow={data.building.name.toUpperCase()} title="My drafts" description="Letters you drafted with BylawIQ. Only you can see them — nothing is sent for you."/>
  <LegalBanner/>
  {data.drafts.length?<div className="draft-list">{data.drafts.map(d=><DraftView key={d.id} draft={d}/>)}</div>
  :<Empty icon={<FolderOpen/>} title="No drafts yet" description="Draft a notice to council or a reply to a strata letter, and it’s saved here for you."
   action={data.aiOn?<div className="action-line" style={{marginTop:16}}><Link className="button button-primary" href={root+'/draft'}><FilePen size={15} aria-hidden/>Draft a notice</Link><Link className="button button-secondary" href={root+'/reply'}><Reply size={15} aria-hidden/>Reply to a letter</Link></div>:undefined}/>}
 </>;
}
