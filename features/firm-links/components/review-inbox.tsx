import Link from 'next/link';
import {ClipboardCheck} from 'lucide-react';
import {Badge,Empty} from '@/components/ui';
import {pretty} from '@/lib/constants';
export function ReviewInbox({items,buildings,base=''}:{base?:''|'/demo';items:{id:string;building_id:string;title:string;kind:string;created_at:string}[];buildings:{id:string;name:string}[]}){
 const name=(id:string)=>buildings.find(b=>b.id===id)?.name||'Building';
 return <section aria-labelledby="review-inbox-heading" style={{marginTop:32}}><div className="section-title"><h2 id="review-inbox-heading">Waiting for your review</h2><Badge>{items.length}</Badge></div>
  {items.length?<ul className="card" style={{listStyle:'none',padding:0}}>{items.map(i=><li key={i.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--line)'}}><Link href={base+'/b/'+i.building_id+'/notices'}><strong>{i.title}</strong></Link><div className="form-note">{name(i.building_id)} · {pretty(i.kind)} · sent {i.created_at.slice(0,10)}</div></li>)}</ul>
  :<Empty icon={<ClipboardCheck/>} title="Nothing to review" description="Drafts your buildings send you for review will appear here, oldest first."/>}</section>;}
