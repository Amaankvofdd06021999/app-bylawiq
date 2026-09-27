'use client';
import {useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Building2,Coins,Database,LogOut,MessageSquare,Receipt,ShieldCheck,Flag,History,Users} from 'lucide-react';
import {Badge,Brand,Button,Empty,PageHeading} from '@/components/ui';
import {useBackend} from '@/components/backend';
import type {PlatformAdminData} from '../types';
import {Section,Stat,date,money,percent,plural} from './parts';
const sections=[['customers','Customers'],['usage','AI usage'],['knowledge','Knowledge health'],['flags','Feature flags'],['audit','Audit']] as const;
/** The platform admin works outside any building, so there is no building sidebar: a slim top bar with the
 * brand, in-page sections and sign out. */
export function PlatformFrame({name,children}:{name:string;children:ReactNode}){
 const router=useRouter(),{base,signOut}=useBackend();const[busy,setBusy]=useState(false);
 return <div className="admin-shell"><a className="skip-link" href="#main">Skip to content</a>
  <header className="topbar admin-topbar"><div className="admin-brand"><Brand/><Badge tone="ai">Platform admin</Badge></div>
   <nav aria-label="Platform sections" className="admin-nav">{sections.map(([id,label])=><a key={id} href={'#'+id}>{label}</a>)}</nav>
   <div className="admin-user"><span className="avatar avatar-small" aria-hidden>{name.split(' ').map(w=>w[0]).slice(0,2).join('')}</span><span className="hide-mobile">{name}</span>
    <Button variant="ghost" size="small" busy={busy} onClick={async()=>{setBusy(true);await signOut();router.push(base||'/login');}}><LogOut size={15}/>Sign out</Button></div></header>
  <main id="main" className="workspace-main">{children}</main></div>;}

function FlagSwitch({on}:{on:boolean}){
 const router=useRouter(),backend=useBackend();const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function toggle(){setBusy(true);setError('');const r=await backend.setFlag({flag:'residentAi',enabled:!on});setBusy(false);if(r.ok)router.refresh();else setError(r.error);}
 return <div className="flag-row"><div><h3 id="flag-resident-ai">Resident AI</h3><p className="form-note">Lets paying residents ask about their own building’s owner-visible documents and use the drafting tools. Turning it off hides Ask from every resident straight away.</p>
  <div className="action-line" style={{marginTop:8}}><Badge tone="warning">Needs legal sign-off before production</Badge><Badge>Demo only</Badge></div>
  {error&&<p role="alert" className="form-error" style={{marginTop:8}}>{error}</p>}</div>
  <button type="button" role="switch" aria-checked={on} aria-labelledby="flag-resident-ai" className="switch" disabled={busy} onClick={toggle}><span className="switch-track"><span className="switch-thumb"/></span><span className="switch-text">{busy?'Saving…':on?'On':'Off'}</span></button></div>;}

export function PlatformAdminDashboard({data}:{data:PlatformAdminData}){
 const {revenue:r,usage:u,knowledge:k}=data;const maxQ=Math.max(1,...u.top.map(t=>t.questions));
 const knowledgeRows:[string,number|string,boolean][]=[['Documents that failed to process',k.failed,k.failed===0],['Documents still processing',k.processing,k.processing===0],['Documents awaiting a human check',k.awaitingReview,k.awaitingReview===0],['Bylaws without a confirmed structure',k.bylawsUnconfirmed,k.bylawsUnconfirmed===0],['Legal corpus passages',k.legalPassages,k.legalPassages>0]];
 return <>
  <PageHeading eyebrow="BYLAWIQ PLATFORM" title="Platform overview" description={`Customers, revenue and AI usage for ${data.month}, across every firm and building. Totals only — no building’s documents or answers appear here.`}/>
  <div className="stats-grid">
   <Stat label="Monthly recurring revenue" icon={<Receipt size={16}/>} value={money(r.mrr)} note={`${plural(r.payingCustomers,'paying customer')} · ${plural(r.trials,'trial')}`}/>
   <Stat label="At launch price" icon={<Coins size={16}/>} value={money(r.launchMrr)} note={`${plural(r.launchCustomers,'customer')} · ${money(r.listMrr-r.mrr)} below list each month`}/>
   <Stat label="Resident credit sales" icon={<Coins size={16}/>} value={money(r.creditSales)} note="This month, before refunds"/>
   <Stat label="Questions asked" icon={<MessageSquare size={16}/>} value={u.questions.toLocaleString('en-US')} note={`About US${money(u.estCostUsd)} in model costs`}/>
  </div>
  <Section id="customers" title="Customers" count={data.customers.length}>
   {data.customers.length?<div className="resource-table"><table><thead><tr><th>Customer</th><th>Plan</th><th className="hide-mobile">Seats</th><th>MRR</th><th className="hide-mobile">Customer since</th></tr></thead><tbody>
    {data.customers.map(c=><tr key={c.id}><td><span className="cell-title">{c.kind==='firm'?<Users size={15} aria-hidden/>:<Building2 size={15} aria-hidden/>}<strong>{c.name}</strong></span><small className="cell-sub">{c.kind==='firm'?'Strata management firm':c.billedTo?'Building · billed to '+c.billedTo:'Independent building'}</small></td>
     <td><span className="action-line">{c.plan}{c.launchDiscount&&<Badge tone="ai">Launch price</Badge>}{c.status==='trial'&&<Badge tone="blue">Trial</Badge>}</span></td>
     <td className="hide-mobile">{c.seatsIncluded?`${c.seatsUsed} of ${c.seatsIncluded}`:'—'}</td>
     <td>{c.billedTo?'Included':<>{c.launchDiscount&&<s className="list-price">{money(c.listPrice)}</s>} {money(c.mrr)}</>}</td><td className="hide-mobile">{date(c.since)}</td></tr>)}
   </tbody></table></div>:<Empty icon={<Users/>} title="No customers yet" description="Firms and buildings appear here once they start a plan or a trial."/>}
  </Section>
  <div className="split-grid dash-split">
   <Section id="usage" title="AI usage">
    <div className="card"><dl className="kv-grid"><div><dt>Questions this month</dt><dd>{u.questions.toLocaleString('en-US')}</dd></div><div><dt>Estimated model cost</dt><dd>US{money(u.estCostUsd)}</dd></div><div><dt>No-grounding rate</dt><dd>{percent(u.noGroundingRate)}</dd></div><div><dt>Answers with no source</dt><dd>{u.noGrounding}</dd></div></dl>
     <h3 className="card-subtitle">Busiest buildings</h3>
     {u.top.length?<ol className="bar-list">{u.top.map(t=><li key={t.buildingId}><span className="bar-label"><span>{t.name}</span><span>{t.questions} · {percent(t.noGroundingRate)} no source</span></span><span className="bar" aria-hidden><span style={{width:Math.round(t.questions/maxQ*100)+'%'}}/></span></li>)}</ol>
      :<p className="form-note">No questions asked yet this month.</p>}</div>
   </Section>
   <Section id="knowledge" title="Knowledge health">
    <div className="card"><div className="health-list" style={{marginTop:0}}>{knowledgeRows.map(([label,value,ok])=><div key={label}>{ok?<ShieldCheck size={15} aria-hidden/>:<Database size={15} aria-hidden className="icon-warn"/>}<span>{label}</span><span>{value}</span></div>)}
     <div><History size={15} aria-hidden/><span>Legal corpus last updated</span><span>{date(k.legalUpdatedAt)}</span></div></div></div>
   </Section>
  </div>
  <Section id="flags" title="Feature flags"><div className="card"><FlagSwitch on={data.flags.residentAi}/></div></Section>
  <Section id="audit" title="Recent platform activity" count={data.audit.length}>
   {data.audit.length?<div className="card">{data.audit.map(a=><div key={a.id} className="activity-row"><span className="file-icon"><Flag size={15}/></span><div><h3>{a.summary}</h3><p>{a.actor}</p></div><time dateTime={a.at}>{date(a.at)}</time></div>)}</div>
    :<Empty icon={<History/>} title="No platform activity yet" description="Plan changes, flag changes and corpus updates are recorded here."/>}
  </Section>
 </>;}
