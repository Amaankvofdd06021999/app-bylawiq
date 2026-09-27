import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {migratedDb,uid,addUsers,type TestDb} from './db-harness';
let t:TestDb;
const firmOwner=uid(101),firmManager=uid(102),firmAssistant=uid(103),manager=uid(104),otherManager=uid(105),rivalOwner=uid(106),councillor=uid(107);
let firmOrg:string,rivalOrg:string,building:string,otherBuilding:string,firmBuilding:string;
const hash=(code:string)=>createHash('sha256').update(code).digest('hex');
const one=async<T>(q:string)=>(await t.rows<T>(q))[0];
beforeAll(async()=>{
 t=await migratedDb();await addUsers(t,firmOwner,firmManager,firmAssistant,manager,otherManager,rivalOwner,councillor);
 await t.identity(firmOwner);firmBuilding=(await one<{id:string}>(`select public.bootstrap_workspace('Coastline Strata','admin','Harbour View','Fiona') id`)).id;
 await t.identity(manager);building=(await one<{id:string}>(`select public.bootstrap_workspace('Seaside Towers','single_building','Seaside Towers','Maya') id`)).id;
 await t.identity(otherManager);otherBuilding=(await one<{id:string}>(`select public.bootstrap_workspace('Parkside','single_building','Parkside','Omar') id`)).id;
 await t.identity(rivalOwner);await t.sql(`select public.bootstrap_workspace('Rival Strata','multi_building','Rival tower','Rita')`);
 await t.admin();
 firmOrg=(await one<{org_id:string}>(`select org_id from public.org_members where user_id='${firmOwner}'`)).org_id;
 rivalOrg=(await one<{org_id:string}>(`select org_id from public.org_members where user_id='${rivalOwner}'`)).org_id;
 await t.sql(`update public.profiles set account_type='multi_building' where id in ('${firmManager}','${firmAssistant}');
  insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${firmManager}','portfolio_manager'),('${firmOrg}','${firmAssistant}','portfolio_assistant');
  update public.profiles set account_type='single_building' where id='${councillor}';
  insert into public.building_members(building_id,user_id,role) values('${building}','${councillor}','council_president');`);
},60000);
afterAll(()=>t.db.close());

describe('firm link tables',()=>{
 let link:string;
 beforeAll(async()=>{await t.admin();
  link=(await one<{id:string}>(`insert into public.firm_building_links(building_id,firm_org_id,status,accepted_at) values('${otherBuilding}','${rivalOrg}','active',now()) returning id`)).id;
  await t.sql(`insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values('${otherBuilding}','firm','${hash('PARK-SIDE')}','${otherManager}',now()+interval '7 days')`);});
 it('marks firm and building organizations by kind',async()=>{await t.admin();expect((await one<{kind:string}>(`select kind from public.organizations where id='${firmOrg}'`)).kind).toBe('firm');expect((await one<{kind:string}>(`select o.kind from public.organizations o join public.buildings b on b.org_id=o.id where b.id='${building}'`)).kind).toBe('building');});
 it('hides another building’s firm link',async()=>{await t.identity(manager);expect(await t.rows(`select id from public.firm_building_links where building_id='${otherBuilding}'`)).toHaveLength(0);});
 it('hides another building’s codes',async()=>{await t.identity(manager);expect(await t.rows(`select id from public.link_codes where building_id='${otherBuilding}'`)).toHaveLength(0);});
 it('shows the link to the building and to the firm',async()=>{await t.identity(otherManager);expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);await t.identity(rivalOwner);expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);});
 it('never exposes a stored code hash',async()=>{await t.identity(otherManager);await expect(t.sql(`select code_hash from public.link_codes`)).rejects.toThrow();});
 it('does not let a user write link rows directly',async()=>{await t.identity(otherManager);await expect(t.sql(`update public.firm_building_links set status='revoked' where id='${link}'`)).rejects.toThrow();await expect(t.sql(`insert into public.firm_building_links(building_id,firm_org_id,status) values('${building}','${rivalOrg}','active')`)).rejects.toThrow();});
 it('adds every active firm staff member to the building through the link',async()=>{await t.admin();await t.sql(`select private.add_link_members('${link}')`);const r=await t.rows<{user_id:string;via_link_id:string}>(`select user_id,via_link_id from public.building_members where building_id='${otherBuilding}' and via_link_id is not null`);expect(r.map(x=>x.user_id)).toEqual([rivalOwner]);});
 it('does not let an authenticated user call the link helper',async()=>{await t.identity(manager);await expect(t.sql(`select private.add_link_members('${link}')`)).rejects.toThrow();});
 it('does not let a user call the internal org-linkage helpers directly',async()=>{await t.identity(manager);await expect(t.sql(`select public.managing_org_ids('${otherBuilding}')`)).rejects.toThrow();await expect(t.sql(`select public.linked_firm_id('${otherBuilding}')`)).rejects.toThrow();});
});
