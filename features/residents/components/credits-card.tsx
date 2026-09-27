'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Coins,History,Receipt} from 'lucide-react';
import {Badge,Button,Empty,Modal,PageHeading} from '@/components/ui';
import {useBackend} from '@/components/backend';
import {shortDate} from '@/lib/dates';
import type {CreditEntry,ResidentData} from '../types';
/** Hand-formatted (not Intl) so the server and the browser print the same text. */
export const creditWord=(n:number)=>`${n} credit${Math.abs(n)===1?'':'s'}`;
/** Demo checkout: one 100-credit pack, clearly labelled as no real charge. */
export function BuyCreditsButton({data,variant='default',label}:{data:ResidentData;variant?:'default'|'secondary';label?:string}){
 const router=useRouter(),backend=useBackend();const pack=data.prices.pack;
 const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState<number|null>(null);
 async function buy(){setBusy(true);setError('');const r=await backend.buyCredits({buildingId:data.building.id});setBusy(false);if(!r.ok){setError(r.error);return;}setDone(r.credits);router.refresh();}
 return <>
  <Button variant={variant} onClick={()=>{setDone(null);setError('');setOpen(true);}}><Coins size={16} aria-hidden/>{label??`Buy ${pack.credits} credits · $${pack.price}`}</Button>
  <Modal open={open} onOpenChange={setOpen} title={`Buy ${pack.credits} credits`} description="Demo — no real charge.">
   {done!=null?<div className="form-stack"><p className="success-note" role="status">{pack.credits} credits added. Your balance is {creditWord(done)}.</p><div className="form-footer"><Button onClick={()=>setOpen(false)}>Done</Button></div></div>
   :<div className="form-stack">
    <p className="checkout-line"><Coins size={16} aria-hidden/><span>{pack.credits} credits for {data.building.name}</span><strong>${pack.price}.00</strong></p>
    <p className="form-note">A question uses {creditWord(data.prices.question)}, a notice to council {creditWord(data.prices.draftNotice)} and a reply to a strata letter {creditWord(data.prices.letterReply)}. Explainers are included. Credits don’t expire.</p>
    <p className="form-note"><strong>Demo — no real charge.</strong> No card is asked for or charged.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="form-footer"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button busy={busy} onClick={buy}>Pay ${pack.price} (demo)</Button></div>
   </div>}
  </Modal>
 </>;
}
/** Balance, free questions left and the buy button — the top of the resident home and the Credits page. */
export function CreditsCard({data,manage=true}:{data:ResidentData;manage?:boolean}){
 const {base}=useBackend();const w=data.wallet;
 return <div className="card credits-card">
  <span className="stat-label">Your credits<Coins size={16} aria-hidden/></span>
  <div className="credit-balance">{w.credits}</div>
  <p className="form-note">{w.freeLeft>0?`${w.freeLeft} of ${w.freeTotal} free questions left, then 1 credit a question.`:`Your ${w.freeTotal} free questions are used. Each question now uses 1 credit.`}</p>
  {w.credits<data.prices.draftNotice&&<p className="inline-callout" style={{marginTop:12}}>You have fewer credits than a notice to council needs ({data.prices.draftNotice}).</p>}
  <div className="action-line" style={{marginTop:16}}><BuyCreditsButton data={data}/>{manage&&<Link className="button button-ghost" href={`${base}/b/${data.building.id}/credits`}><History size={15} aria-hidden/>Credit history</Link>}</div>
 </div>;
}
export function CreditHistory({entries,limit}:{entries:CreditEntry[];limit?:number}){
 const shown=limit?entries.slice(0,limit):entries;
 if(!shown.length)return <Empty icon={<Receipt/>} title="No credit activity yet" description="Purchases and the tools you use appear here."/>;
 return <div className="card" role="list" aria-label="Credit activity">{shown.map(e=><div role="listitem" key={e.id} className="activity-row"><span className="file-icon"><Receipt size={15} aria-hidden/></span><div><h3>{e.label}</h3><p><time dateTime={e.at}>{shortDate(e.at)}</time></p></div>{e.delta>0?<Badge tone="green">+{e.delta}</Badge>:e.delta<0?<Badge>{e.delta}</Badge>:<Badge tone="blue">Free</Badge>}</div>)}</div>;
}
/** The Credits page: balance, what each tool costs, and the full history. */
export function CreditsPage({data}:{data:ResidentData}){
 const p=data.prices;
 const costs:[string,string][]=[['Ask BylawIQ',`${creditWord(p.question)} a question · first ${data.wallet.freeTotal} free`],['Explainers','Included'],['Draft a notice to council',creditWord(p.draftNotice)],['Reply to a strata letter',creditWord(p.letterReply)]];
 return <>
  <PageHeading eyebrow={data.building.name.toUpperCase()} title="Credits" description="Pay only for what you use. Credits stay with your unit’s account."/>
  <div className="split-grid dash-split">
   <section className="dash-section" aria-label="Balance"><CreditsCard data={data} manage={false}/></section>
   <section className="dash-section" aria-labelledby="costs-heading"><div className="card"><h2 id="costs-heading" className="card-heading">What each tool costs</h2><dl className="cost-list">{costs.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p className="form-note" style={{marginTop:12}}>A question that finds nothing in your documents is refunded.</p></div></section>
  </div>
  <div className="section-title"><h2>Credit history</h2><Badge>{data.history.length}</Badge></div>
  <CreditHistory entries={data.history}/>
 </>;
}
