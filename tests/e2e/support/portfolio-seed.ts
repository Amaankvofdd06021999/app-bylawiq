import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { assertLocalSupabase } from './local-mfa';

/**
 * Fixtures for the strata-manager portfolio: one firm with two linked buildings, a strata manager who is a firm
 * portfolio manager, and an outsider who manages an unrelated firm's building. Accounts and buildings are created
 * through the product functions where they exist (bootstrap_workspace, create_building, add_link_members). Firm-link
 * rows and a few documents are written directly, which is a fixture shortcut, not a product path. Local stack only.
 */

const CONTAINER = 'supabase_db_bylawiq';

export type PortfolioAccount = { id: string; email: string; password: string };
export type PortfolioFixture = {
  firm: string;
  strata: PortfolioAccount;
  outsider: PortfolioAccount;
  owner: PortfolioAccount;
  buildingA: { id: string; name: string };
  buildingB: { id: string; name: string };
  buildingOther: { id: string; name: string };
};

function sql(statements: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
    { input: statements, encoding: 'utf8' },
  ).trim();
}

function asUser(userId: string, statements: string): string {
  return sql(`set request.jwt.claim.sub = '${userId}';\n${statements}`);
}

async function createAuthUser(url: string, label: string, stamp: string): Promise<PortfolioAccount> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const email = `e2e-${label}-${stamp}@example.invalid`;
  const password = `E2e-${randomBytes(12).toString('base64url')}-1`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating a local test user failed with status ${res.status}`);
  const body = (await res.json()) as { id?: unknown };
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id))
    throw new Error('Unexpected user id shape');
  return { id: body.id, email, password };
}

export async function seedPortfolio(): Promise<PortfolioFixture> {
  const url = assertLocalSupabase();
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const firm = `E2E portfolio firm ${stamp}`;
  const buildingAName = `E2E portfolio A ${stamp}`;
  const buildingBName = `E2E portfolio B ${stamp}`;
  const otherName = `E2E other building ${stamp}`;
  const owner = await createAuthUser(url, 'owner', stamp);
  const strata = await createAuthUser(url, 'strata', stamp);
  const outsider = await createAuthUser(url, 'outsider', stamp);

  // The firm owner creates the firm with building A, then adds building B through the product function.
  asUser(
    owner.id,
    `select public.bootstrap_workspace('${firm}', 'admin', '${buildingAName}', 'Firm owner');`,
  );
  const firmId = sql(`select id from public.organizations where name = '${firm}';`);
  asUser(
    owner.id,
    // The second argument is the strata plan number, which must be unique.
    `select public.create_building('${firmId}', '${buildingBName}', 'BCS-${stamp}', '2 Main Street', 12);`,
  );
  const buildingAId = sql(`select id from public.buildings where name = '${buildingAName}';`);
  const buildingBId = sql(`select id from public.buildings where name = '${buildingBName}';`);

  // The outsider runs an unrelated firm and building.
  asUser(
    outsider.id,
    `select public.bootstrap_workspace('E2E other firm ${stamp}', 'admin', '${otherName}', 'Outsider');`,
  );
  const otherId = sql(`select id from public.buildings where name = '${otherName}';`);

  // Building B is linked to the firm, as building A is by bootstrap. The strata manager is a portfolio manager of the
  // firm, and the link adds them to each linked building.
  // create_building may already link the new building; add the link only when none is active.
  sql(`insert into public.firm_building_links (building_id, firm_org_id, status, invited_by, accepted_by, accepted_at)
    select '${buildingBId}', '${firmId}', 'active', '${owner.id}', '${owner.id}', now()
    where not exists (select 1 from public.firm_building_links where building_id = '${buildingBId}' and status = 'active');`);
  sql(
    `insert into public.org_members (org_id, user_id, role, status) values ('${firmId}', '${strata.id}', 'portfolio_manager', 'active');`,
  );
  // The strata manager has accepted the terms in the real onboarding; the fixture records the same state.
  sql(`update public.profiles set consent_at = now() where id = '${strata.id}';`);
  const links = sql(
    `select id from public.firm_building_links where firm_org_id = '${firmId}' and status = 'active';`,
  )
    .split('\n')
    .filter(Boolean);
  for (const link of links) sql(`select private.add_link_members('${link}');`);

  // Documents in each building: one waiting for confirmation in A, one ready in B.
  sql(`insert into public.documents (building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date)
    values ('${buildingAId}', 'Pet rules', 'rules', 'x/a/source.txt', '${owner.id}', 'review', 10, '2024-01-01');`);
  sql(`insert into public.documents (building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date)
    values ('${buildingBId}', 'Parking rules', 'rules', 'x/b/source.txt', '${owner.id}', 'ready', 10, '2024-01-01');`);

  return {
    firm,
    owner,
    strata,
    outsider,
    buildingA: { id: buildingAId, name: buildingAName },
    buildingB: { id: buildingBId, name: buildingBName },
    buildingOther: { id: otherId, name: otherName },
  };
}

/** A failed upload in building B, for the failure state on the portfolio. */
export function addFailedUpload(buildingId: string, ownerId: string) {
  sql(`insert into public.documents (building_id, title, type, storage_path, uploaded_by, status, byte_size, error_message)
    values ('${buildingId}', 'Broken minutes', 'council_minutes', 'x/f/source.txt', '${ownerId}', 'failed', 10, 'Indexing could not complete.');`);
}

export function portfolioDocumentStatus(title: string, buildingId: string): string {
  return sql(
    `select status from public.documents where building_id = '${buildingId}' and title = '${title}' and deleted_at is null order by created_at desc limit 1;`,
  );
}
