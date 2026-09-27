import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {seed} from '@/mock/store';
import {IDS} from '@/mock/data';
import {accessibleBuildings} from '@/mock/rules';
import {mutate,createFirmCode,revokeFirmLink,acceptFirmCode,createChat,branchChat} from '@/mock/mutations';
const {seaside,parkside}=IDS.buildings;
const {james,sarah,grace,omar,priya,ben,dana}=IDS.users;
const FORBIDDEN='You do not have permission for this action.';
function ok<T extends {ok:boolean}>(r:T):Extract<T,{ok:true}>{if(!r.ok)throw new Error('Expected ok: '+JSON.stringify(r));return r as Extract<T,{ok:true}>;}
describe('mock mutations: firm links',()=>{
 it('replaces a code, links Sarah through the new one and removes her on revoke',()=>{
  const s=seed();
  const created=ok(createFirmCode(s,omar,{buildingId:parkside}));
  expect(created.url).toBe('/demo/workspace?code='+created.code);
  expect(acceptFirmCode(s,sarah,{code:'park7qk4',firmOrgId:IDS.orgs.coastline})).toEqual({ok:false,error:'That code was replaced or cancelled. Ask the building for a new one.'});
  expect(acceptFirmCode(s,sarah,{code:'ZZZZZZZZ',firmOrgId:IDS.orgs.coastline})).toEqual({ok:false,error:'That code isn’t valid. Check it and try again.'});
  expect(acceptFirmCode(s,sarah,{code:created.code.toLowerCase().replace('-',''),firmOrgId:IDS.orgs.coastline})).toEqual({ok:true,buildingId:parkside});
  expect(accessibleBuildings(s,sarah).map(b=>b.id)).toContain(parkside);
  expect(createFirmCode(s,omar,{buildingId:parkside})).toEqual({ok:false,error:'This building already has a strata management firm. The building must remove that firm first.'});
  expect(revokeFirmLink(s,sarah,{buildingId:parkside})).toEqual({ok:false,error:FORBIDDEN});
  expect(revokeFirmLink(s,omar,{buildingId:parkside})).toEqual({ok:true});
  expect(accessibleBuildings(s,sarah).map(b=>b.id)).not.toContain(parkside);
  expect(s.audit.some(a=>a.action==='firm_building_links.update'&&a.building_id===parkside)).toBe(true);
 });
 it('only lets a firm manager accept, and returns firm reviews to draft on revoke',()=>{
  const s=seed();
  expect(acceptFirmCode(s,james,{code:'PARK-7QK4',firmOrgId:IDS.orgs.coastline})).toEqual({ok:false,error:FORBIDDEN});
  ok(revokeFirmLink(s,james,{buildingId:seaside}));
  const n=s.notices.find(x=>x.id===IDS.notices.seasidePendingReview);
  expect(n?.status).toBe('draft');
  expect(s.comments.some(c=>c.document_id===IDS.notices.seasidePendingReview&&c.body==='Strata management access was removed, so this review was returned to draft.')).toBe(true);
  expect(accessibleBuildings(s,sarah).map(b=>b.id)).not.toContain(seaside);
  expect(s.invitations.find(i=>i.building_id===seaside)?.revoked_at).toBeNull();
 });
});
describe('mock mutations: firm review flow',()=>{
 it('runs send → blocked approval → changes requested → edit → resend → approve',()=>{
  const s=seed();const id=IDS.notices.seasideDraft;const b=seaside;
  const status=()=>s.notices.find(n=>n.id===id)?.status;
  ok(mutate(s,james,{buildingId:b,operation:'notice.firm_review',id,values:{confirmed:true}}));
  expect(status()).toBe('pending_review');
  expect(mutate(s,grace,{buildingId:b,operation:'notice.transition',id,values:{status:'approved',confirmed:true}})).toEqual({ok:false,error:'The firm is reviewing this document. Wait for their decision.'});
  expect(mutate(s,james,{buildingId:b,operation:'notice.firm_decision',id,values:{decision:'approved',confirmed:true}})).toEqual({ok:false,error:FORBIDDEN});
  expect(mutate(s,sarah,{buildingId:b,operation:'notice.firm_decision',id,values:{decision:'changes_requested',comment:'  ',confirmed:true}})).toEqual({ok:false,error:'Add a comment explaining what needs to change.'});
  ok(mutate(s,sarah,{buildingId:b,operation:'notice.firm_decision',id,values:{decision:'changes_requested',comment:'Cite section 4.1.',confirmed:true}}));
  expect(status()).toBe('changes_requested');
  expect(s.comments.some(c=>c.document_id===id&&c.body==='Cite section 4.1.'&&c.author_id===sarah)).toBe(true);
  ok(mutate(s,james,{buildingId:b,operation:'notice.save',id,values:{title:'Visitor parking · Reply',body:'Section 4.1 covers visitor permits.',kind:'email'}}));
  expect(status()).toBe('draft');
  ok(mutate(s,james,{buildingId:b,operation:'notice.firm_review',id,values:{confirmed:true}}));
  ok(mutate(s,james,{buildingId:b,operation:'notice.save',id,values:{title:'Visitor parking · Reply',body:'Section 4.1 covers visitor permits again.',kind:'email'}}));
  expect(s.comments.some(c=>c.document_id===id&&c.body==='This draft was edited, which withdrew it from strata management review.')).toBe(true);
  ok(mutate(s,james,{buildingId:b,operation:'notice.firm_review',id,values:{confirmed:true}}));
  ok(mutate(s,sarah,{buildingId:b,operation:'notice.firm_decision',id,values:{decision:'approved',confirmed:true}}));
  expect(s.notices.find(n=>n.id===id)).toMatchObject({status:'approved',approved_by:sarah});
  ok(mutate(s,james,{buildingId:b,operation:'notice.comment',id,values:{body:'Thanks.'}}));
 });
 it('blocks self-approval of an enforcement notice',()=>{
  const s=seed();
  const created=ok(mutate(s,james,{buildingId:seaside,operation:'notice.save',values:{title:'Noise · Unit 812',body:'Notice of a noise complaint.',kind:'s135_notice'}}));
  ok(mutate(s,james,{buildingId:seaside,operation:'notice.transition',id:created.id,values:{status:'pending_review',confirmed:true}}));
  expect(mutate(s,james,{buildingId:seaside,operation:'notice.transition',id:created.id,values:{status:'approved',confirmed:true}})).toEqual({ok:false,error:'Another authorized reviewer must approve this notice.'});
  ok(mutate(s,grace,{buildingId:seaside,operation:'notice.transition',id:created.id,values:{status:'approved',confirmed:true}}));
 });
});
describe('mock mutations: resident',()=>{
 const ops:[string,Record<string,unknown>][]=[['building.update',{}],['knowledge.save',{}],['agent.save',{}],['agent.deploy',{}],['document.update',{}],['document.delete',{}],['document.confirm',{}],['bylaw.save',{}],['bylaw.transition',{}],['bylaw.register',{}],['notice.save',{}],['notice.transition',{}],['notice.firm_review',{}],['notice.firm_decision',{}],['notice.comment',{}],['dispute.save',{}],['dispute.event',{}],['update.state',{state:'viewed'}],['member.change',{}],['member.invite',{}],['invite.revoke',{}],['org.update',{}],['chat.rename',{}],['chat.archive',{}],['building.create',{}],['building.archive',{}],['knowledge.delete',{}],['agent.pause',{}],['agent.delete',{}]];
 it('gets the forbidden message for every operation',()=>{
  const s=seed();
  for(const [operation,values] of ops)expect(mutate(s,priya,{buildingId:seaside,operation,id:randomUUID(),values}),operation).toEqual({ok:false,error:FORBIDDEN});
  expect(createFirmCode(s,priya,{buildingId:seaside})).toEqual({ok:false,error:FORBIDDEN});
  expect(revokeFirmLink(s,priya,{buildingId:seaside})).toEqual({ok:false,error:FORBIDDEN});
 });
 it('cannot start a building conversation',()=>{
  const s=seed();
  expect(createChat(s,priya,{buildingId:seaside})).toEqual({ok:false,error:FORBIDDEN});
 });
});
describe('mock mutations: CRUD',()=>{
 it('edits, confirms and deletes documents',()=>{
  const s=seed();const doc=s.documents.find(d=>d.building_id===seaside&&d.status==='review');
  ok(mutate(s,james,{buildingId:seaside,operation:'document.update',id:doc?.id,values:{title:'Insurance summary',type:'insurance'}}));
  expect(s.documents.find(d=>d.id===doc?.id)?.title).toBe('Insurance summary');
  ok(mutate(s,james,{buildingId:seaside,operation:'document.confirm',id:doc?.id,values:{}}));
  expect(s.documents.find(d=>d.id===doc?.id)).toMatchObject({status:'ready',structure_confirmed:true});
  expect(mutate(s,james,{buildingId:seaside,operation:'document.confirm',id:doc?.id,values:{}})).toEqual({ok:false,error:'This action is not available at the current stage.'});
  ok(mutate(s,james,{buildingId:seaside,operation:'document.delete',id:doc?.id,values:{}}));
  expect(s.documents.some(d=>d.id===doc?.id)).toBe(false);
  const harbourDoc=s.documents.find(d=>d.building_id===IDS.buildings.harbour);
  expect(mutate(s,james,{buildingId:seaside,operation:'document.delete',id:harbourDoc?.id,values:{}})).toEqual({ok:false,error:'This record is unavailable in the selected building.'});
  expect(s.audit.some(a=>a.action==='documents.update'&&a.target_id===doc?.id)).toBe(true);
 });
 it('walks a bylaw amendment from draft to in force',()=>{
  const s=seed();
  const saved=ok(mutate(s,james,{buildingId:seaside,operation:'bylaw.save',values:{title:'Short-term rentals',section:'5.2',body:'A strata lot may not be rented for less than 30 days.'}}));
  const t=(values:Record<string,unknown>)=>mutate(s,james,{buildingId:seaside,operation:'bylaw.transition',id:saved.id,values});
  expect(t({status:'proposed',review:'without_review'})).toEqual({ok:false,error:'Arrange legal review or record a specific justification before proposing.'});
  expect(t({status:'filed',filing:'LF-1',effective:'2026-01-01'})).toEqual({ok:false,error:'This action is not available at the current stage.'});
  ok(t({status:'proposed',review:'counsel'}));
  ok(t({status:'voted',for:30,against:5,abstain:1}));
  ok(t({status:'adopted'}));
  ok(t({status:'filed',filing:'LF-2026-0400',effective:'2024-09-01'}));
  ok(t({status:'in_force'}));
  expect(s.versions.find(v=>v.id===saved.id)?.status).toBe('in_force');
  expect(mutate(s,ben,{buildingId:seaside,operation:'bylaw.save',values:{title:'x',section:'1',body:'Some body.'}})).toEqual({ok:false,error:FORBIDDEN});
 });
 it('records a registered bylaw imported from a document',()=>{
  const s=seed();const node=s.bylaws.find(n=>n.building_id===seaside);
  s.versions.push({id:randomUUID(),building_id:seaside,node_id:node?.id,version:9,status:'draft',body:'Imported text.',source_document_id:s.documents[0].id,created_at:'2024-09-01T00:00:00Z'});
  const v=s.versions[s.versions.length-1];
  ok(mutate(s,james,{buildingId:seaside,operation:'bylaw.register',id:v.id,values:{filing:'LF-2026-0001',effective:'2024-09-01'}}));
  expect(v).toMatchObject({status:'in_force',review_choice:'registered'});
 });
 it('opens a dispute and logs an event once per key',()=>{
  const s=seed();
  const d=ok(mutate(s,james,{buildingId:seaside,operation:'dispute.save',values:{title:'Balcony smoke · Unit 502',category:'nuisance',unit:'502'}}));
  expect(s.disputes.find(x=>x.id===d.id)).toMatchObject({stage:'reported',subject_unit:'502'});
  const key=randomUUID();
  const event={disputeId:d.id,stage:'warning_sent',occurredAt:'2024-09-20T09:00:00Z',summary:'Warning letter sent.',key,confirmed:true};
  ok(mutate(s,james,{buildingId:seaside,operation:'dispute.event',values:event}));
  ok(mutate(s,james,{buildingId:seaside,operation:'dispute.event',values:event}));
  expect(s.events.filter(e=>e.dispute_id===d.id)).toHaveLength(1);
  expect(s.disputes.find(x=>x.id===d.id)?.stage).toBe('warning_sent');
 });
 it('saves, deploys, pauses and deletes an agent',()=>{
  const s=seed();
  const kb=ok(mutate(s,james,{buildingId:seaside,operation:'knowledge.save',values:{name:'Empty base'}}));
  const empty=ok(mutate(s,james,{buildingId:seaside,operation:'agent.save',values:{name:'Empty agent',knowledgeBaseId:kb.id}}));
  expect(mutate(s,james,{buildingId:seaside,operation:'agent.deploy',id:empty.id,values:{}})).toEqual({ok:false,error:'Add and finish indexing a knowledge source before deploying.'});
  const a=ok(mutate(s,james,{buildingId:seaside,operation:'agent.save',values:{name:'Parking helper'}}));
  expect(s.agents.find(x=>x.id===a.id)?.status).toBe('draft');
  ok(mutate(s,james,{buildingId:seaside,operation:'agent.deploy',id:a.id,values:{}}));
  expect(s.agents.find(x=>x.id===a.id)?.status).toBe('deployed');
  expect(s.deployments.filter(x=>x.agent_id===a.id)).toHaveLength(1);
  const seeded=s.agents.find(x=>x.building_id===seaside&&x.id!==a.id&&x.id!==empty.id);
  ok(mutate(s,james,{buildingId:seaside,operation:'agent.deploy',id:seeded?.id,values:{}}));
  ok(mutate(s,james,{buildingId:seaside,operation:'agent.pause',id:a.id,values:{}}));
  expect(s.agents.find(x=>x.id===a.id)?.status).toBe('paused');
  ok(mutate(s,james,{buildingId:seaside,operation:'agent.delete',id:a.id,values:{}}));
  expect(s.agents.some(x=>x.id===a.id)).toBe(false);
 });
 it('invites, changes and protects members',()=>{
  const s=seed();
  const invite=ok(mutate(s,james,{buildingId:seaside,operation:'member.invite',values:{email:'New.Person@Example.com',role:'council_member'}}));
  expect(invite.url).toMatch(/^\/demo\/invite\/[a-f0-9]{64}$/);
  expect(s.invitations.find(i=>i.id===invite.id)?.email).toBe('new.person@example.com');
  expect(mutate(s,james,{buildingId:seaside,operation:'member.invite',values:{email:'x@example.com',role:'portfolio_manager'}})).toEqual({ok:false,error:FORBIDDEN});
  expect(mutate(s,james,{buildingId:seaside,operation:'member.invite',values:{email:'priya.nair@seasidetowers.example',role:'council_member'}})).toEqual({ok:false,error:'This person is already a member of this building. Change their role from Members instead.'});
  ok(mutate(s,james,{buildingId:seaside,operation:'invite.revoke',id:invite.id,values:{}}));
  expect(s.invitations.find(i=>i.id===invite.id)?.revoked_at).not.toBeNull();
  const benRow=s.members.find(m=>m.user_id===ben&&m.building_id===seaside);
  ok(mutate(s,james,{buildingId:seaside,operation:'member.change',id:benRow?.id,values:{role:'external_counsel'}}));
  expect(benRow?.role).toBe('external_counsel');
  const sarahRow=s.members.find(m=>m.user_id===sarah&&m.building_id===seaside);
  expect(mutate(s,james,{buildingId:seaside,operation:'member.change',id:sarahRow?.id,values:{role:'council_member'}})).toEqual({ok:false,error:'Strata management access is managed as a whole. Remove the firm from Settings instead.'});
  const graceRow=s.members.find(m=>m.user_id===grace&&m.building_id===seaside);
  expect(mutate(s,james,{buildingId:seaside,operation:'member.change',id:graceRow?.id,values:{role:'council_member'}})).toEqual({ok:false,error:FORBIDDEN});
  expect(mutate(s,sarah,{buildingId:seaside,operation:'member.change',id:graceRow?.id,values:{role:'council_member'}})).toEqual({ok:false,error:FORBIDDEN});
 });
 it('lets a council member only mark updates viewed',()=>{
  const s=seed();const u=s.updates.find(x=>x.building_id===seaside);
  ok(mutate(s,ben,{buildingId:seaside,operation:'update.state',id:u?.id,values:{state:'viewed'}}));
  expect(mutate(s,ben,{buildingId:seaside,operation:'update.state',id:u?.id,values:{state:'actioned'}})).toEqual({ok:false,error:FORBIDDEN});
  ok(mutate(s,james,{buildingId:seaside,operation:'update.state',id:u?.id,values:{state:'actioned'}}));
  expect(u?.state).toBe('actioned');
 });
 it('creates a firm building linked to the firm',()=>{
  const s=seed();
  const b=ok(mutate(s,dana,{buildingId:seaside,operation:'building.create',values:{orgId:IDS.orgs.coastline,name:'Lighthouse Point',units:24}}));
  expect(accessibleBuildings(s,sarah).map(x=>x.id)).toContain(b.id);
  expect(mutate(s,dana,{buildingId:seaside,operation:'building.archive',values:{}})).toEqual({ok:false,error:FORBIDDEN});
  expect(mutate(s,james,{buildingId:seaside,operation:'building.create',values:{orgId:IDS.orgs.coastline,name:'Nope'}})).toEqual({ok:false,error:FORBIDDEN});
 });
 it('returns the validation message for bad values',()=>{
  const s=seed();
  expect(mutate(s,james,{buildingId:seaside,operation:'dispute.save',values:{title:''}})).toEqual({ok:false,error:'Check the highlighted fields and try again.'});
 });
});
describe('mock mutations: chats',()=>{
 it('creates, renames, branches and archives a conversation',()=>{
  const s=seed();
  const c=ok(createChat(s,james,{buildingId:seaside}));
  expect(s.chats.find(x=>x.id===c.id)).toMatchObject({title:'New conversation',user_id:james,scope:'building'});
  ok(mutate(s,james,{buildingId:seaside,operation:'chat.rename',id:c.id,values:{title:'Parking'}}));
  expect(mutate(s,sarah,{buildingId:seaside,operation:'chat.rename',id:c.id,values:{title:'Mine now'}})).toEqual({ok:false,error:'This record is unavailable in the selected building.'});
  const firstUser=s.messages.find(m=>m.chatId===IDS.chats.jamesConversation&&m.role==='user');
  const branch=ok(branchChat(s,james,{chatId:IDS.chats.jamesConversation,messageId:firstUser?.id}));
  expect(s.chats.find(x=>x.id===branch.id)?.title).toBe('Can residents use visitor parking? · branch');
  expect(branchChat(s,sarah,{chatId:IDS.chats.jamesConversation,messageId:firstUser?.id})).toEqual({ok:false,error:FORBIDDEN});
  ok(mutate(s,james,{buildingId:seaside,operation:'chat.archive',id:c.id,values:{}}));
  expect(s.chats.find(x=>x.id===c.id)?.archived).toBe(true);
 });
});
