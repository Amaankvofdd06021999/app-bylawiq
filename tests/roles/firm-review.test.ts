import { beforeAll, describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { migratedDb, uid, addUsers, type TestDb } from '../db-harness';

// Decisions D2 and D13: firm review is a link-scoped permission ('firm.review'), enforced in Postgres.
const OWNER = uid(501); // firm owner who creates the firm and the linked building
const STAFF = uid(502); // firm portfolio manager, linked to the building
const BUILDING_MANAGER = uid(503); // building manager of an unrelated, single-building account
const OTHER_FIRM_OWNER = uid(504); // owner of a different firm
const NOTICE_AUTHOR = uid(505); // unused placeholder kept for clarity of ids (not a member of anything)

describe('firm review is link-scoped (D2) and firm staff map to building_manager (D13)', () => {
  let t: TestDb;
  let firmId: string;
  let buildingId: string;
  let linkId: string;

  async function createNotice(as: string, building: string, title: string): Promise<string> {
    await t.identity(as);
    const [row] = await t.rows<{ id: string }>(
      `insert into public.generated_documents (building_id, title, kind, body_md, created_by)
       values ('${building}', '${title}', 'council_report', 'Body text for review.', '${as}') returning id`,
    );
    await t.rows(`select public.request_firm_review('${row.id}')`);
    return row.id;
  }

  beforeAll(async () => {
    t = await migratedDb();
    await addUsers(t, OWNER, STAFF, BUILDING_MANAGER, OTHER_FIRM_OWNER, NOTICE_AUTHOR);

    // The firm owner creates the firm and the building (the same path the golden accounts used).
    await t.identity(OWNER);
    const [b] = await t.rows<{ bootstrap_workspace: string }>(
      `select public.bootstrap_workspace('Firm F','admin','Building B','Owner') as bootstrap_workspace`,
    );
    buildingId = b.bootstrap_workspace;

    await t.admin();
    const [f] = await t.rows<{ id: string }>(
      `select id from public.organizations where kind = 'firm' and created_by = '${OWNER}'`,
    );
    firmId = f.id;
    const [l] = await t.rows<{ id: string }>(
      `select id from public.firm_building_links where building_id = '${buildingId}' and firm_org_id = '${firmId}' and status = 'active'`,
    );
    linkId = l.id;

    // Firm staff joins the firm after the building exists, then the link is refreshed (what joining does).
    await t.sql(
      `insert into public.org_members(org_id, user_id, role, status) values ('${firmId}', '${STAFF}', 'portfolio_manager', 'active');`,
    );
    await t.sql(`select private.add_link_members('${linkId}');`);

    // Unrelated building manager and another firm's owner.
    await t.identity(BUILDING_MANAGER);
    await t.rows(
      `select public.bootstrap_workspace('Solo','single_building','Solo Building','Manager') as bootstrap_workspace`,
    );
    await t.identity(OTHER_FIRM_OWNER);
    await t.rows(
      `select public.bootstrap_workspace('Firm X','admin','Building X','Other Owner') as bootstrap_workspace`,
    );
    await t.admin();
  });

  it('linked firm staff join the building as building_manager', async () => {
    await t.admin();
    const rows = await t.rows<{ role: string; via_link_id: string | null }>(
      `select role::text as role, via_link_id from public.building_members where building_id = '${buildingId}' and user_id = '${STAFF}'`,
    );
    expect(rows).toEqual([{ role: 'building_manager', via_link_id: linkId }]);
  });

  it('firm.review is true for an active firm reviewer on a linked building, and false for building-only staff', async () => {
    await t.identity(STAFF);
    expect(await t.rows(`select public.authorize('firm.review','${buildingId}') as ok`)).toEqual([
      { ok: true },
    ]);
    await t.identity(BUILDING_MANAGER);
    expect(await t.rows(`select public.authorize('firm.review','${buildingId}') as ok`)).toEqual([
      { ok: false },
    ]);
    expect(await t.rows(`select public.authorize('review.act','${buildingId}') as ok`)).toEqual([
      { ok: false },
    ]);
  });

  it('building_manager does not hold review.act anywhere, so firm review cannot widen the role', async () => {
    await t.admin();
    const rows = await t.rows(
      `select 1 from public.role_permissions where role = 'building_manager' and permission = 'review.act'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('only the linked firm reviewer can approve a firm-review notice', async () => {
    const notice = await createNotice(OWNER, buildingId, 'Review scope check');

    await t.identity(BUILDING_MANAGER);
    await expect(t.rows(`select public.decide_firm_review('${notice}','approved','')`)).rejects.toThrow(
      /forbidden/,
    );

    await t.identity(OTHER_FIRM_OWNER);
    await expect(t.rows(`select public.decide_firm_review('${notice}','approved','')`)).rejects.toThrow(
      /forbidden/,
    );

    await t.identity(STAFF);
    await t.rows(`select public.decide_firm_review('${notice}','approved','')`);
    await t.admin();
    const [doc] = await t.rows<{ status: string }>(
      `select status::text as status from public.generated_documents where id = '${notice}'`,
    );
    expect(doc.status).toBe('approved');
  });

  it('a firm reviewer loses the power when the link is revoked', async () => {
    const notice = await createNotice(OWNER, buildingId, 'After revoke');
    await t.admin();
    await t.sql(
      `update public.firm_building_links set status = 'revoked', revoked_at = now() where id = '${linkId}';`,
    );

    await t.identity(STAFF);
    await expect(t.rows(`select public.decide_firm_review('${notice}','approved','')`)).rejects.toThrow(
      /forbidden/,
    );
    expect(await t.rows(`select public.authorize('firm.review','${buildingId}') as ok`)).toEqual([
      { ok: false },
    ]);

    // Restore the link for any later test in this file.
    await t.admin();
    await t.sql(
      `update public.firm_building_links set status = 'active', revoked_at = null where id = '${linkId}';`,
    );
  });

  it('the firm owner can decide because they are an active firm member on the link (current behaviour, stated)', async () => {
    const notice = await createNotice(OWNER, buildingId, 'Owner decision');
    await t.identity(OWNER);
    await t.rows(`select public.decide_firm_review('${notice}','changes_requested','Please add the date.')`);
    await t.admin();
    const [doc] = await t.rows<{ status: string }>(
      `select status::text as status from public.generated_documents where id = '${notice}'`,
    );
    expect(doc.status).toBe('changes_requested');
  });

  it('the golden-row backfill changes only org_owner building memberships on building-kind organisations', async () => {
    // Run the backfill statement from the migration file itself, against rows that look like the golden ones.
    const migration = await readFile(
      'supabase/migrations/20261031000046_firm_review_and_building_roles.sql',
      'utf8',
    );
    const backfill = migration.slice(migration.lastIndexOf('update public.building_members m'));
    const legacyUser = uid(510);
    await t.admin();
    await t.sql(
      `insert into auth.users(id,email,email_confirmed_at) values ('${legacyUser}','legacy@example.test',now());` +
        `insert into public.organizations(id,name,created_by,kind) values ('${uid(511)}','Legacy building org','${legacyUser}','building');` +
        `insert into public.buildings(id,org_id,name) values ('${uid(512)}','${uid(511)}','Legacy building');` +
        `insert into public.building_members(building_id,user_id,role) values ('${uid(512)}','${legacyUser}','org_owner');`,
    );
    await t.sql(backfill);
    const rows = await t.rows<{ role: string }>(
      `select role::text as role from public.building_members where building_id = '${uid(512)}' and user_id = '${legacyUser}'`,
    );
    expect(rows).toEqual([{ role: 'building_manager' }]);
    // The firm membership of the firm owner is untouched.
    const firmRows = await t.rows<{ role: string }>(
      `select role::text as role from public.org_members where org_id = '${firmId}' and user_id = '${OWNER}'`,
    );
    expect(firmRows).toEqual([{ role: 'org_owner' }]);
  });
});
