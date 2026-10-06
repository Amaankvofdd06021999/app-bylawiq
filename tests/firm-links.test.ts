import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { migratedDb, uid, addUsers, type TestDb } from './db-harness';
let t: TestDb;
const firmOwner = uid(101),
  firmManager = uid(102),
  firmAssistant = uid(103),
  manager = uid(104),
  otherManager = uid(105),
  rivalOwner = uid(106),
  councillor = uid(107);
let firmOrg: string, rivalOrg: string, building: string, otherBuilding: string, firmBuilding: string;
const hash = (code: string) => createHash('sha256').update(code).digest('hex');
const one = async <T>(q: string) => (await t.rows<T>(q))[0];
beforeAll(async () => {
  t = await migratedDb();
  await addUsers(t, firmOwner, firmManager, firmAssistant, manager, otherManager, rivalOwner, councillor);
  await t.identity(firmOwner);
  firmBuilding = (
    await one<{ id: string }>(
      `select public.bootstrap_workspace('Coastline Strata','admin','Harbour View','Fiona') id`,
    )
  ).id;
  await t.identity(manager);
  building = (
    await one<{ id: string }>(
      `select public.bootstrap_workspace('Seaside Towers','single_building','Seaside Towers','Maya') id`,
    )
  ).id;
  await t.identity(otherManager);
  otherBuilding = (
    await one<{ id: string }>(
      `select public.bootstrap_workspace('Parkside','single_building','Parkside','Omar') id`,
    )
  ).id;
  await t.identity(rivalOwner);
  await t.sql(`select public.bootstrap_workspace('Rival Strata','multi_building','Rival tower','Rita')`);
  await t.admin();
  firmOrg = (
    await one<{ org_id: string }>(`select org_id from public.org_members where user_id='${firmOwner}'`)
  ).org_id;
  rivalOrg = (
    await one<{ org_id: string }>(`select org_id from public.org_members where user_id='${rivalOwner}'`)
  ).org_id;
  await t.sql(`update public.profiles set account_type='multi_building' where id in ('${firmManager}','${firmAssistant}');
  insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${firmManager}','portfolio_manager'),('${firmOrg}','${firmAssistant}','portfolio_assistant');
  update public.profiles set account_type='single_building' where id='${councillor}';
  insert into public.building_members(building_id,user_id,role) values('${building}','${councillor}','council_president');`);
}, 60000);
afterAll(() => t.db.close());

describe('firm link tables', () => {
  let link: string;
  beforeAll(async () => {
    await t.admin();
    link = (
      await one<{ id: string }>(
        `insert into public.firm_building_links(building_id,firm_org_id,status,accepted_at) values('${otherBuilding}','${rivalOrg}','active',now()) returning id`,
      )
    ).id;
    await t.sql(
      `insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values('${otherBuilding}','firm','${hash('PARK-SIDE')}','${otherManager}',now()+interval '7 days')`,
    );
  });
  it('marks firm and building organizations by kind', async () => {
    await t.admin();
    expect(
      (await one<{ kind: string }>(`select kind from public.organizations where id='${firmOrg}'`)).kind,
    ).toBe('firm');
    expect(
      (
        await one<{ kind: string }>(
          `select o.kind from public.organizations o join public.buildings b on b.org_id=o.id where b.id='${building}'`,
        )
      ).kind,
    ).toBe('building');
  });
  it('hides another building’s firm link', async () => {
    await t.identity(manager);
    expect(
      await t.rows(`select id from public.firm_building_links where building_id='${otherBuilding}'`),
    ).toHaveLength(0);
  });
  it('hides another building’s codes', async () => {
    await t.identity(manager);
    expect(
      await t.rows(`select id from public.link_codes where building_id='${otherBuilding}'`),
    ).toHaveLength(0);
  });
  it('shows the link to the building and to the firm', async () => {
    await t.identity(otherManager);
    expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);
    await t.identity(rivalOwner);
    expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);
  });
  it('never exposes a stored code hash', async () => {
    await t.identity(otherManager);
    await expect(t.sql(`select code_hash from public.link_codes`)).rejects.toThrow();
  });
  it('does not let a user write link rows directly', async () => {
    await t.identity(otherManager);
    await expect(
      t.sql(`update public.firm_building_links set status='revoked' where id='${link}'`),
    ).rejects.toThrow();
    await expect(
      t.sql(
        `insert into public.firm_building_links(building_id,firm_org_id,status) values('${building}','${rivalOrg}','active')`,
      ),
    ).rejects.toThrow();
  });
  it('adds every active firm staff member to the building through the link', async () => {
    await t.admin();
    await t.sql(`select private.add_link_members('${link}')`);
    const r = await t.rows<{ user_id: string; via_link_id: string }>(
      `select user_id,via_link_id from public.building_members where building_id='${otherBuilding}' and via_link_id is not null`,
    );
    expect(r.map((x) => x.user_id)).toEqual([rivalOwner]);
  });
  it('does not let an authenticated user call the link helper', async () => {
    await t.identity(manager);
    await expect(t.sql(`select private.add_link_members('${link}')`)).rejects.toThrow();
  });
  it('does not let a user call the internal org-linkage helpers directly', async () => {
    await t.identity(manager);
    await expect(t.sql(`select public.managing_org_ids('${otherBuilding}')`)).rejects.toThrow();
    await expect(t.sql(`select public.linked_firm_id('${otherBuilding}')`)).rejects.toThrow();
  });
});

describe('buildings own their organization', () => {
  it('puts a firm’s first building in its own building organization linked to the firm', async () => {
    await t.admin();
    const r = await one<{ kind: string; firm: string }>(
      `select o.kind,l.firm_org_id firm from public.buildings b join public.organizations o on o.id=b.org_id join public.firm_building_links l on l.building_id=b.id and l.status='active' where b.id='${firmBuilding}'`,
    );
    expect(r).toEqual({ kind: 'building', firm: firmOrg });
  });
  it('gives all firm staff access to a building the firm creates', async () => {
    await t.identity(firmOwner);
    const created = (
      await one<{ id: string }>(`select public.create_building('${firmOrg}','Marina Court',null,'',null) id`)
    ).id;
    for (const u of [firmOwner, firmManager, firmAssistant]) {
      await t.identity(u);
      expect((await one<{ ok: boolean }>(`select public.has_building_access('${created}') ok`)).ok).toBe(
        true,
      );
    }
  });
  it('does not let a building organization create buildings', async () => {
    await t.identity(manager);
    const org = (await one<{ org_id: string }>(`select org_id from public.buildings where id='${building}'`))
      .org_id;
    await expect(
      t.sql(`select public.create_building('${org}','Sneaky annex',null,'',null)`),
    ).rejects.toThrow('forbidden');
  });
  it('moves an existing firm-owned building into its own organization without losing access', async () => {
    const legacyOwner = uid(120);
    await addUsers(t, legacyOwner);
    await t.admin();
    const org = (
      await one<{ id: string }>(
        `insert into public.organizations(name,created_by,kind,letterhead) values('Legacy Strata','${legacyOwner}','firm','Legacy letterhead') returning id`,
      )
    ).id;
    await t.sql(
      `update public.profiles set account_type='admin' where id='${legacyOwner}';insert into public.org_members(org_id,user_id,role) values('${org}','${legacyOwner}','org_owner');`,
    );
    const old = (
      await one<{ id: string }>(
        `insert into public.buildings(org_id,name) values('${org}','Legacy Place') returning id`,
      )
    ).id;
    await t.sql(
      `insert into public.building_members(building_id,user_id,role) values('${old}','${legacyOwner}','org_owner')`,
    );
    expect((await one<{ n: number }>(`select private.split_firm_buildings() n`)).n).toBe(1);
    const r = await one<{ kind: string; letterhead: string; via: string | null }>(
      `select o.kind,o.letterhead,m.via_link_id via from public.buildings b join public.organizations o on o.id=b.org_id join public.building_members m on m.building_id=b.id and m.user_id='${legacyOwner}' where b.id='${old}'`,
    );
    expect(r.kind).toBe('building');
    expect(r.letterhead).toBe('Legacy letterhead');
    expect(r.via).not.toBeNull();
    await t.identity(legacyOwner);
    expect((await one<{ ok: boolean }>(`select public.authorize('chat.use','${old}') ok`)).ok).toBe(true);
  });
  it('uses the linked firm’s letterhead for a managed building', async () => {
    await t.admin();
    await t.sql(`update public.organizations set letterhead='Coastline letterhead' where id='${firmOrg}'`);
    await t.identity(firmOwner);
    expect(
      (
        await one<{ letterhead: string }>(
          `select letterhead from public.building_letterhead('${firmBuilding}')`,
        )
      ).letterhead,
    ).toBe('Coastline letterhead');
  });
  it('returns no letterhead for a building the caller cannot use', async () => {
    await t.identity(manager);
    expect(await t.rows(`select letterhead from public.building_letterhead('${firmBuilding}')`)).toHaveLength(
      0,
    );
  });
});

describe('inviting, accepting and removing a firm', () => {
  const code = 'SEAS-7QK4';
  const hasAccess = async (u: string) => {
    await t.identity(u);
    return (await one<{ ok: boolean }>(`select public.has_building_access('${building}') ok`)).ok;
  };
  it('does not let a council member without link rights create a firm code', async () => {
    const member = uid(130);
    await addUsers(t, member);
    await t.admin();
    await t.sql(
      `update public.profiles set account_type='single_building' where id='${member}';insert into public.building_members(building_id,user_id,role) values('${building}','${member}','council_member')`,
    );
    await t.identity(member);
    await expect(
      t.sql(`select public.create_firm_code('${building}','${hash('NOPE-NOPE')}')`),
    ).rejects.toThrow('forbidden');
  });
  it('shows no firm before an invitation', async () => {
    await t.identity(manager);
    expect(
      (await one<{ status: string }>(`select status from public.building_firm_status('${building}')`)).status,
    ).toBe('none');
  });
  it('lets the building manager create a code and shows the invitation as pending', async () => {
    await t.identity(manager);
    await t.sql(`select public.create_firm_code('${building}','${hash(code)}')`);
    expect(
      (await one<{ status: string }>(`select status from public.building_firm_status('${building}')`)).status,
    ).toBe('invited');
  });
  it('hides the firm status from another building', async () => {
    await t.identity(otherManager);
    expect(await t.rows(`select status from public.building_firm_status('${building}')`)).toHaveLength(0);
  });
  it('does not let a firm assistant accept a code', async () => {
    await t.identity(firmAssistant);
    await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`)).rejects.toThrow(
      'forbidden',
    );
  });
  it('does not let someone accept on behalf of a firm they do not belong to', async () => {
    await t.identity(rivalOwner);
    await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`)).rejects.toThrow(
      'forbidden',
    );
  });
  it('rejects an unknown code', async () => {
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.accept_firm_code('${hash('ZZZZ-ZZZZ')}','${firmOrg}')`),
    ).rejects.toThrow('invalid_code');
  });
  it('links the firm and gives all its staff access when a manager accepts', async () => {
    await t.identity(firmManager);
    expect(
      (await one<{ b: string }>(`select public.accept_firm_code('${hash(code)}','${firmOrg}') b`)).b,
    ).toBe(building);
    for (const u of [firmOwner, firmManager, firmAssistant]) expect(await hasAccess(u)).toBe(true);
    await t.identity(manager);
    expect(
      await one<{ status: string; firm_name: string }>(
        `select status,firm_name from public.building_firm_status('${building}')`,
      ),
    ).toMatchObject({ status: 'active', firm_name: 'Coastline Strata' });
  });
  it('does not accept the same code twice, even for another firm', async () => {
    await t.identity(rivalOwner);
    await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${rivalOrg}')`)).rejects.toThrow(
      'invalid_code',
    );
  });
  it('does not create a second code while a firm is linked', async () => {
    await t.identity(manager);
    await expect(
      t.sql(`select public.create_firm_code('${building}','${hash('SECO-NDCD')}')`),
    ).rejects.toThrow('firm_already_linked');
  });
  it('gives a new firm staff member access and removes it when they leave', async () => {
    const hire = uid(131);
    await addUsers(t, hire);
    await t.admin();
    await t.sql(
      `update public.profiles set account_type='multi_building' where id='${hire}';insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${hire}','portfolio_assistant')`,
    );
    expect(await hasAccess(hire)).toBe(true);
    await t.admin();
    await t.sql(`update public.org_members set status='suspended' where user_id='${hire}'`);
    expect(await hasAccess(hire)).toBe(false);
  });
  it('removes access immediately when a firm staff member’s org_members row is deleted, not just suspended', async () => {
    const hire = uid(132);
    await addUsers(t, hire);
    await t.admin();
    await t.sql(
      `update public.profiles set account_type='multi_building' where id='${hire}';insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${hire}','portfolio_assistant')`,
    );
    expect(await hasAccess(hire)).toBe(true);
    await t.admin();
    await t.sql(`delete from public.org_members where user_id='${hire}'`);
    expect(await hasAccess(hire)).toBe(false);
  });
  it('does not let a firm link reactivate a membership the building itself suspended', async () => {
    const staff = uid(133);
    await addUsers(t, staff);
    await t.admin();
    await t.sql(
      `update public.profiles set account_type='multi_building' where id='${staff}';insert into public.building_members(building_id,user_id,role,status) values('${building}','${staff}','council_member','suspended')`,
    );
    await t.sql(
      `insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${staff}','portfolio_assistant')`,
    );
    expect(await hasAccess(staff)).toBe(false);
  });
  it('does not let linked firm staff remove the building manager', async () => {
    await t.admin();
    const m = (
      await one<{ id: string }>(
        `select id from public.building_members where building_id='${building}' and user_id='${manager}'`,
      )
    ).id;
    await t.identity(firmOwner);
    await expect(t.sql(`select public.change_membership('${m}','council_member',true)`)).rejects.toThrow(
      'forbidden',
    );
  });
  it('does not let linked firm staff archive the building', async () => {
    await t.identity(firmOwner);
    await expect(t.sql(`select public.archive_building('${building}')`)).rejects.toThrow('forbidden');
  });
  it('does not let the building remove one linked firm member on their own', async () => {
    await t.admin();
    const m = (
      await one<{ id: string }>(
        `select id from public.building_members where building_id='${building}' and user_id='${firmAssistant}'`,
      )
    ).id;
    await t.identity(manager);
    await expect(t.sql(`select public.change_membership('${m}','council_member',true)`)).rejects.toThrow(
      'linked_member',
    );
  });
  it('does not let the firm remove itself', async () => {
    await t.identity(firmOwner);
    await expect(t.sql(`select public.revoke_firm_link('${building}')`)).rejects.toThrow('forbidden');
  });
  it('removes every firm staff member’s access immediately when the building revokes', async () => {
    await t.identity(councillor);
    await t.sql(`select public.revoke_firm_link('${building}')`);
    for (const u of [firmOwner, firmManager, firmAssistant]) expect(await hasAccess(u)).toBe(false);
    await t.identity(manager);
    expect(
      (await one<{ status: string }>(`select status from public.building_firm_status('${building}')`)).status,
    ).toBe('none');
  });
  it('keeps the building’s own people after revoking', async () => {
    expect(await hasAccess(manager)).toBe(true);
    expect(await hasAccess(councillor)).toBe(true);
  });
  it('rejects an expired code', async () => {
    await t.identity(manager);
    await t.sql(`select public.create_firm_code('${building}','${hash('OLDC-ODE2')}')`);
    await t.admin();
    await t.sql(
      `update public.link_codes set expires_at=now()-interval '1 minute' where code_hash='${hash('OLDC-ODE2')}'`,
    );
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.accept_firm_code('${hash('OLDC-ODE2')}','${firmOrg}')`),
    ).rejects.toThrow('expired_code');
  });
  it('rejects a code the building replaced with a newer one', async () => {
    await t.identity(manager);
    await t.sql(`select public.create_firm_code('${building}','${hash('FRST-CODE')}')`);
    await t.sql(`select public.create_firm_code('${building}','${hash('SCND-CODE')}')`);
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.accept_firm_code('${hash('FRST-CODE')}','${firmOrg}')`),
    ).rejects.toThrow('revoked_code');
  });
  it('rejects a resident code offered as a firm code', async () => {
    await t.admin();
    await t.sql(
      `insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values('${building}','resident','${hash('RESI-DENT')}','${manager}',now()+interval '1 day')`,
    );
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.accept_firm_code('${hash('RESI-DENT')}','${firmOrg}')`),
    ).rejects.toThrow('wrong_code_kind');
  });
  it('turns a revoked firm member re-invited by email into an ordinary member', async () => {
    await t.identity(manager);
    await t.sql(
      `select public.create_invitation('${building}','${firmAssistant.slice(-4)}@example.test','council_member','reinvite-hash',null)`,
    );
    await t.identity(firmAssistant);
    await t.sql(`select public.accept_invitation('reinvite-hash')`);
    await t.admin();
    expect(
      (
        await one<{ via: string | null }>(
          `select via_link_id via from public.building_members where building_id='${building}' and user_id='${firmAssistant}'`,
        )
      ).via,
    ).toBeNull();
  });
  it('rejects a code for a building that has since been archived', async () => {
    const newManager = uid(140);
    await addUsers(t, newManager);
    await t.identity(newManager);
    const b = (
      await one<{ id: string }>(
        `select public.bootstrap_workspace('Archived Towers','single_building','Archived Towers','Nia') id`,
      )
    ).id;
    await t.sql(`select public.create_firm_code('${b}','${hash('ARCH-IVED')}')`);
    await t.admin();
    await t.sql(`update public.buildings set deleted_at=now() where id='${b}'`);
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.accept_firm_code('${hash('ARCH-IVED')}','${firmOrg}')`),
    ).rejects.toThrow('invalid_code');
  });
});

describe('sending a draft to the firm for review', () => {
  let draft: string;
  const code = 'REVW-CODE';
  const statusOf = async () => {
    await t.admin();
    return await one<{ status: string; review_by: string }>(
      `select status,review_by from public.generated_documents where id='${draft}'`,
    );
  };
  beforeAll(async () => {
    await t.identity(manager);
    draft = (
      await one<{ id: string }>(
        `insert into public.generated_documents(building_id,created_by,title,kind,body_md) values('${building}','${manager}','Noise notice','s135_notice','A draft for review') returning id`,
      )
    ).id;
  });
  it('cannot be sent while no firm is linked', async () => {
    await t.identity(manager);
    await expect(t.sql(`select public.request_firm_review('${draft}')`)).rejects.toThrow('no_firm_link');
  });
  it('goes to the firm once a firm is linked', async () => {
    await t.identity(manager);
    await t.sql(`select public.create_firm_code('${building}','${hash(code)}')`);
    await t.identity(firmManager);
    await t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`);
    await t.identity(manager);
    await t.sql(`select public.request_firm_review('${draft}')`);
    expect(await statusOf()).toEqual({ status: 'pending_review', review_by: 'firm' });
  });
  it('cannot be approved by the building while the firm is reviewing it', async () => {
    await t.identity(councillor);
    await expect(t.sql(`select public.transition_artifact('${draft}','approved')`)).rejects.toThrow(
      'firm_review_pending',
    );
  });
  it('needs a comment to request changes', async () => {
    await t.identity(firmManager);
    await expect(
      t.sql(`select public.decide_firm_review('${draft}','changes_requested','')`),
    ).rejects.toThrow('comment_required');
  });
  it('does not let a firm assistant decide', async () => {
    await t.identity(firmAssistant);
    await expect(t.sql(`select public.decide_firm_review('${draft}','approved','')`)).rejects.toThrow(
      'forbidden',
    );
  });
  it('returns to the author with the firm’s comment', async () => {
    await t.identity(firmManager);
    await t.sql(
      `select public.decide_firm_review('${draft}','changes_requested','Cite bylaw 4.1 and the date of the complaint.')`,
    );
    expect((await statusOf()).status).toBe('changes_requested');
    await t.identity(manager);
    expect(
      (
        await t.rows<{ body: string }>(
          `select body from public.document_review_comments where document_id='${draft}'`,
        )
      ).map((r) => r.body),
    ).toContain('Cite bylaw 4.1 and the date of the complaint.');
  });
  it('cannot resend around the firm’s decision without editing first', async () => {
    await t.identity(manager);
    await expect(t.sql(`select public.transition_artifact('${draft}','pending_review')`)).rejects.toThrow(
      'invalid_transition',
    );
  });
  it('withdraws from firm review and leaves a comment when the author edits it mid-review', async () => {
    await t.identity(manager);
    await t.sql(`select public.request_firm_review('${draft}')`);
    expect(await statusOf()).toEqual({ status: 'pending_review', review_by: 'firm' });
    await t.sql(`select public.save_artifact('${draft}','Noise notice','A revised draft citing bylaw 4.1')`);
    expect(await statusOf()).toEqual({ status: 'draft', review_by: 'building' });
    expect(
      (
        await t.rows<{ body: string }>(
          `select body from public.document_review_comments where document_id='${draft}' order by created_at`,
        )
      ).map((r) => r.body),
    ).toContain('This draft was edited, which withdrew it from strata management review.');
  });
  it('lets the author edit and resend, and the firm approve', async () => {
    await t.identity(manager);
    await t.sql(`select public.save_artifact('${draft}','Noise notice','A revised draft citing bylaw 4.1')`);
    await t.sql(`select public.request_firm_review('${draft}')`);
    await t.identity(firmManager);
    await t.sql(`select public.decide_firm_review('${draft}','approved','')`);
    expect((await statusOf()).status).toBe('approved');
  });
  it('hides review comments from another building', async () => {
    await t.identity(otherManager);
    expect(
      await t.rows(`select id from public.document_review_comments where building_id='${building}'`),
    ).toHaveLength(0);
  });
  it('does not let anyone write a comment row directly', async () => {
    await t.identity(manager);
    await expect(
      t.sql(
        `insert into public.document_review_comments(document_id,building_id,author_id,body) values('${draft}','${building}','${manager}','Forged')`,
      ),
    ).rejects.toThrow();
  });
  it('lets the building comment on a review, visible to the firm', async () => {
    await t.identity(manager);
    const id = (
      await one<{ id: string }>(
        `select public.comment_on_review('${draft}','Please also check the visitor parking rules.') id`,
      )
    ).id;
    await t.identity(firmManager);
    expect(
      (
        await t.rows<{ body: string }>(`select body from public.document_review_comments where id='${id}'`)
      ).map((r) => r.body),
    ).toContain('Please also check the visitor parking rules.');
  });
  it('does not let another building comment on this review', async () => {
    await t.identity(otherManager);
    await expect(t.sql(`select public.comment_on_review('${draft}','Sneaky comment')`)).rejects.toThrow(
      'forbidden',
    );
  });
  it('does not let the firm approve its own draft', async () => {
    await t.admin();
    const id = (
      await one<{ id: string }>(
        `insert into public.generated_documents(building_id,created_by,title,kind,body_md,status,review_by) values('${building}','${firmManager}','Firm-authored notice','s135_notice','Drafted by the firm','pending_review','firm') returning id`,
      )
    ).id;
    await t.identity(firmManager);
    await expect(t.sql(`select public.decide_firm_review('${id}','approved','')`)).rejects.toThrow(
      'self_approval_not_permitted',
    );
  });
  it('does not let a linked firm member send a document for firm review', async () => {
    await t.identity(firmManager);
    await expect(t.sql(`select public.request_firm_review('${draft}')`)).rejects.toThrow('forbidden');
  });
  it('returns an open firm review to draft when the firm is removed', async () => {
    await t.identity(manager);
    const second = (
      await one<{ id: string }>(
        `insert into public.generated_documents(building_id,created_by,title,kind,body_md) values('${building}','${manager}','Parking notice','s135_notice','Another draft') returning id`,
      )
    ).id;
    await t.sql(`select public.request_firm_review('${second}')`);
    await t.sql(`select public.revoke_firm_link('${building}')`);
    await t.admin();
    expect(await one(`select status,review_by from public.generated_documents where id='${second}'`)).toEqual(
      { status: 'draft', review_by: 'building' },
    );
  });
});

describe('linked firm staff cannot leave access behind after a revoke', () => {
  const code = 'STAF-LINK';
  const councilMember = uid(150),
    invitee = uid(151),
    promotee = uid(152);
  beforeAll(async () => {
    await addUsers(t, councilMember, invitee, promotee);
    await t.admin();
    await t.sql(
      `update public.profiles set account_type='single_building' where id in ('${councilMember}','${invitee}','${promotee}');insert into public.building_members(building_id,user_id,role) values('${building}','${councilMember}','council_member')`,
    );
    await t.identity(manager);
    await t.sql(`select public.create_firm_code('${building}','${hash(code)}')`);
    await t.identity(firmManager);
    await t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`);
  });
  it('does not let linked firm staff invite someone as building manager', async () => {
    await t.identity(firmOwner);
    await expect(
      t.sql(
        `select public.create_invitation('${building}','${promotee.slice(-4)}@example.test','building_manager','linked-bm-hash',null)`,
      ),
    ).rejects.toThrow('forbidden');
  });
  it('does not let linked firm staff promote a council member to organization admin', async () => {
    await t.admin();
    const m = (
      await one<{ id: string }>(
        `select id from public.building_members where building_id='${building}' and user_id='${councilMember}'`,
      )
    ).id;
    await t.identity(firmOwner);
    await expect(t.sql(`select public.change_membership('${m}','org_admin')`)).rejects.toThrow('forbidden');
    await t.admin();
    expect(
      (await one<{ role: string }>(`select role from public.building_members where id='${m}'`)).role,
    ).toBe('council_member');
  });
  it('revokes a pending invitation sent by linked firm staff when the building revokes the firm', async () => {
    await t.identity(firmOwner);
    const i = (
      await one<{ id: string }>(
        `select public.create_invitation('${building}','${invitee.slice(-4)}@example.test','council_member','linked-cm-hash',null) id`,
      )
    ).id;
    await t.identity(manager);
    await t.sql(`select public.revoke_firm_link('${building}')`);
    await t.admin();
    expect(
      (
        await one<{ revoked: boolean }>(
          `select revoked_at is not null revoked from public.invitations where id='${i}'`,
        )
      ).revoked,
    ).toBe(true);
    await t.identity(invitee);
    await expect(t.sql(`select public.accept_invitation('linked-cm-hash')`)).rejects.toThrow(
      'invalid_invitation',
    );
    await t.identity(invitee);
    expect((await one<{ ok: boolean }>(`select public.has_building_access('${building}') ok`)).ok).toBe(
      false,
    );
  });
});
