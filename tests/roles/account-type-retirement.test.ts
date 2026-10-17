import { beforeAll, describe, it, expect } from 'vitest';
import { migratedDb, uid, addUsers, type TestDb } from '../db-harness';

// Decisions D3 and D17: authorization reads bound_building_id, never profiles.account_type.
// Addresses for invitations come from addUsers: the email is the last four digits of the id plus @example.test.
const FIRM_OWNER = uid(601);
const SOLO = uid(602);
const RESIDENT = uid(603);
const PORTFOLIO = uid(604);

const emailOf = (id: string) => `${id.slice(-4)}@example.test`;

describe('single-building binding is explicit; account_type is not used for authorization (D3, D17)', () => {
  let t: TestDb;
  let firmBuilding: string;
  let soloBuilding: string;

  beforeAll(async () => {
    t = await migratedDb();
    await addUsers(t, FIRM_OWNER, SOLO, RESIDENT, PORTFOLIO);

    await t.identity(FIRM_OWNER);
    const [f] = await t.rows<{ b: string }>(
      `select public.bootstrap_workspace('Firm F','admin','Firm Building','Owner') as b`,
    );
    firmBuilding = f.b;

    await t.identity(SOLO);
    const [s] = await t.rows<{ b: string }>(
      `select public.bootstrap_workspace('Solo','single_building','Solo Building','Solo') as b`,
    );
    soloBuilding = s.b;
  });

  it('bootstrap marks a single-building account by bound_building_id and writes no account_type', async () => {
    await t.admin();
    const rows = await t.rows<{
      id: string;
      bound: string | null;
      account_type: string | null;
      consent: boolean;
    }>(
      `select id, bound_building_id as bound, account_type::text as account_type, consent_at is not null as consent
         from public.profiles where id in ('${FIRM_OWNER}','${SOLO}') order by id`,
    );
    const solo = rows.find((r) => r.id === SOLO)!;
    const owner = rows.find((r) => r.id === FIRM_OWNER)!;
    expect(solo.bound).toBe(soloBuilding);
    expect(solo.account_type).toBeNull();
    expect(solo.consent).toBe(true);
    expect(owner.bound).toBeNull();
    expect(owner.account_type).toBeNull();
  });

  it('bootstrap can run only once per account', async () => {
    await t.identity(SOLO);
    await expect(
      t.rows(`select public.bootstrap_workspace('Again','single_building','Again','Solo')`),
    ).rejects.toThrow(/already_configured/);
  });

  it('a resident invited to one building joins it and cannot join a second single building', async () => {
    // Firm owner invites the resident to the firm building.
    await t.identity(FIRM_OWNER);
    await t.rows(
      `select public.create_invitation('${firmBuilding}','${emailOf(RESIDENT)}','owner_resident','${'a'.repeat(64)}',null)`,
    );
    await t.identity(RESIDENT);
    await t.rows(`select public.accept_invitation('${'a'.repeat(64)}')`);
    await t.admin();
    const [bound] = await t.rows<{ bound: string | null }>(
      `select bound_building_id as bound from public.profiles where id = '${RESIDENT}'`,
    );
    expect(bound.bound).toBe(firmBuilding);

    // Solo manager invites the same resident to their own building; acceptance is refused by the binding.
    await t.identity(SOLO);
    await t.rows(
      `select public.create_invitation('${soloBuilding}','${emailOf(RESIDENT)}','owner_resident','${'b'.repeat(64)}',null)`,
    );
    await t.identity(RESIDENT);
    await expect(t.rows(`select public.accept_invitation('${'b'.repeat(64)}')`)).rejects.toThrow(
      /single_building_bound/,
    );
  });

  it('a portfolio manager is not bound to one building, so the constraint never applies to them', async () => {
    // A firm-level assignment: after D13 the firm owner is building_manager on the building, which cannot assign
    // portfolio roles (can_assign). Portfolio assignment belongs to firm team management (phase P4); the invitation
    // is written directly here to test the binding rule only.
    await t.admin();
    await t.sql(
      `insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values ('${firmBuilding}','${emailOf(PORTFOLIO)}','portfolio_manager','${FIRM_OWNER}','${'c'.repeat(64)}',null);`,
    );
    await t.identity(PORTFOLIO);
    await t.rows(`select public.accept_invitation('${'c'.repeat(64)}')`);
    await t.admin();
    const [p] = await t.rows<{ bound: string | null }>(
      `select bound_building_id as bound from public.profiles where id = '${PORTFOLIO}'`,
    );
    expect(p.bound).toBeNull();
  });

  it('building managers and council presidents may invite residents; council members may not invite anyone (D1)', async () => {
    await t.admin();
    const COUNCIL_MEMBER = uid(605);
    await addUsers(t, COUNCIL_MEMBER);
    await t.sql(
      `insert into public.building_members(building_id,user_id,role) values ('${soloBuilding}','${COUNCIL_MEMBER}','council_member');`,
    );
    await t.identity(COUNCIL_MEMBER);
    await expect(
      t.rows(
        `select public.create_invitation('${soloBuilding}','${emailOf(uid(606))}','owner_resident','${'d'.repeat(64)}',null)`,
      ),
    ).rejects.toThrow(/forbidden/);

    await t.identity(SOLO);
    await t.rows(
      `select public.create_invitation('${soloBuilding}','${emailOf(uid(607))}','owner_resident','${'e'.repeat(64)}',null)`,
    );
  });
});
