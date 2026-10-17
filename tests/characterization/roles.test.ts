import { beforeAll, describe, it, expect } from 'vitest';
import { migratedDb, uid, addUsers, type TestDb } from '../db-harness';

// Characterization tests: they pin how roles and permissions behave TODAY, so every later change to the role model
// is deliberate. Each expectation here was read from the live database's role_permissions table before the change.
// When a planned change lands (see docs/…backlog), the matching expectation is updated in the same commit.

const LIVE_MATRIX: Record<string, string[]> = {
  org_owner: [
    'agent.deploy',
    'agent.manage',
    'audit.read',
    'billing.manage',
    'building.create',
    'building.delete',
    'building.read',
    'building.update',
    'bylaw.adopt',
    'bylaw.edit',
    'chat.use',
    'chat.use_portfolio',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.approve',
    'document.draft',
    'document.send',
    'member.invite',
    'member.read',
    'member.remove',
    'member.update_role',
    'org.manage',
    'review.act',
    'vault.delete',
    'vault.read',
    'vault.upload',
  ],
  org_admin: [
    'agent.deploy',
    'agent.manage',
    'audit.read',
    'building.create',
    'building.delete',
    'building.read',
    'building.update',
    'bylaw.adopt',
    'bylaw.edit',
    'chat.use',
    'chat.use_portfolio',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.approve',
    'document.draft',
    'document.send',
    'member.invite',
    'member.read',
    'member.remove',
    'member.update_role',
    'org.manage',
    'review.act',
    'vault.delete',
    'vault.read',
    'vault.upload',
  ],
  portfolio_manager: [
    'agent.deploy',
    'agent.manage',
    'audit.read',
    'building.create',
    'building.read',
    'bylaw.adopt',
    'bylaw.edit',
    'chat.use',
    'chat.use_portfolio',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.approve',
    'document.draft',
    'document.send',
    'member.invite',
    'member.read',
    'member.remove',
    'member.update_role',
    'review.act',
    'vault.delete',
    'vault.read',
    'vault.upload',
  ],
  portfolio_assistant: [
    'building.read',
    'bylaw.edit',
    'chat.use',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.draft',
    'member.read',
    'vault.read',
    'vault.upload',
  ],
  building_manager: [
    'agent.deploy',
    'agent.manage',
    'audit.read',
    'building.link_firm',
    'building.read',
    'bylaw.adopt',
    'bylaw.edit',
    'chat.use',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.approve',
    'document.draft',
    'document.send',
    'member.invite',
    'member.read',
    'member.remove',
    'member.update_role',
    'vault.delete',
    'vault.read',
    'vault.upload',
  ],
  council_president: [
    'agent.deploy',
    'agent.manage',
    'audit.read',
    'building.link_firm',
    'building.read',
    'bylaw.adopt',
    'bylaw.edit',
    'chat.use',
    'dispute.create',
    'dispute.read',
    'dispute.update',
    'document.approve',
    'document.draft',
    'document.send',
    'member.invite',
    'member.read',
    'member.remove',
    'member.update_role',
    'vault.delete',
    'vault.read',
    'vault.upload',
  ],
  council_member: ['building.read', 'chat.use', 'dispute.read', 'member.read', 'vault.read'],
  external_counsel: ['building.read', 'chat.use', 'dispute.read', 'member.read', 'vault.read'],
  owner_resident: ['building.read', 'vault.read'],
};

describe('characterization: role_permissions matches the live matrix', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await migratedDb();
  });

  it('every role holds exactly the permissions recorded from the live database', async () => {
    const rows = await t.rows<{ role: string; permission: string }>(
      'select role::text as role, permission::text as permission from public.role_permissions',
    );
    const actual: Record<string, string[]> = {};
    for (const r of rows) (actual[r.role] ||= []).push(r.permission);
    for (const list of Object.values(actual)) list.sort();
    expect(Object.keys(actual).sort()).toEqual(Object.keys(LIVE_MATRIX).sort());
    for (const [role, perms] of Object.entries(LIVE_MATRIX)) {
      expect(actual[role], role).toEqual([...perms].sort());
    }
  });

  it('platform_admin has no building-level permissions in the matrix', async () => {
    const rows = await t.rows(`select permission from public.role_permissions where role = 'platform_admin'`);
    expect(rows).toHaveLength(0);
  });
});

describe('characterization: how buildings and roles are created today', () => {
  let t: TestDb;
  const firmOwner = uid(401);
  const soloManager = uid(402);

  beforeAll(async () => {
    t = await migratedDb();
    await addUsers(t, firmOwner, soloManager);
  });

  it('a firm owner who creates a building gets building_manager on it (decision D13; was org_owner before 20261031000046)', async () => {
    await t.identity(firmOwner);
    const [{ bootstrap_workspace: building }] = await t.rows<{ bootstrap_workspace: string }>(
      `select public.bootstrap_workspace('Firm A','admin','Building A','Firm Owner') as bootstrap_workspace`,
    );
    await t.admin();
    const rows = await t.rows<{ role: string; org_kind: string }>(
      `select m.role::text as role, o.kind::text as org_kind from public.building_members m
         join public.buildings b on b.id = m.building_id join public.organizations o on o.id = b.org_id
        where m.building_id = '${building}' and m.user_id = '${firmOwner}'`,
    );
    expect(rows).toEqual([{ role: 'building_manager', org_kind: 'building' }]);
  });

  it('a single-building account gets building_manager on its own building', async () => {
    await t.identity(soloManager);
    const [{ bootstrap_workspace: building }] = await t.rows<{ bootstrap_workspace: string }>(
      `select public.bootstrap_workspace('Solo','single_building','Solo Building','Solo Manager') as bootstrap_workspace`,
    );
    await t.admin();
    const rows = await t.rows<{ role: string }>(
      `select role::text as role from public.building_members where building_id = '${building}' and user_id = '${soloManager}'`,
    );
    expect(rows).toEqual([{ role: 'building_manager' }]);
  });
});
