import { generateCode, normalizeCode, hashCode } from '@/lib/link-codes';
import { AppError, ForbiddenError } from '@/lib/errors';
import { buildingInput, acceptInput } from '@/features/firm-links/schema';
import { audit, newId, type MockState } from '../store';
import { addLinkMembers, inDays, need, now, raise, run, type Result } from './shared';
// Mirrors features/firm-links/actions.ts and the `create_firm_code` / `accept_firm_code` / `revoke_firm_link`
// functions in supabase/migrations/20260927092000_firm_link_codes.sql and 20260927093000_firm_review.sql.
const activeLink = (s: MockState, buildingId: string) =>
  s.firmLinks.find((l) => l.building_id === buildingId && l.status === 'active');
function revokeOpenCodes(s: MockState, buildingId: string): void {
  for (const c of s.linkCodes)
    if (c.building_id === buildingId && c.kind === 'firm' && c.revoked_at == null && c.used_at == null)
      c.revoked_at = now();
}
export function createFirmCode(
  s: MockState,
  userId: string,
  raw: unknown,
): Result<{ code: string; url: string }> {
  return run(() => {
    const { buildingId } = buildingInput.parse(raw);
    need(s, userId, 'building.link_firm', buildingId);
    if (activeLink(s, buildingId)) raise('firm_already_linked');
    revokeOpenCodes(s, buildingId);
    const code = generateCode();
    const id = newId();
    s.linkCodes.push({
      id,
      building_id: buildingId,
      kind: 'firm',
      code_hash: hashCode(code),
      created_by: userId,
      expires_at: inDays(7),
      used_at: null,
      revoked_at: null,
      created_at: now(),
    });
    audit(s, userId, buildingId, 'link_codes.insert', id);
    return { code, url: '/demo/workspace?code=' + code };
  });
}
export function revokeFirmLink(s: MockState, userId: string, raw: unknown): Result<object> {
  return run(() => {
    const { buildingId } = buildingInput.parse(raw);
    need(s, userId, 'building.link_firm', buildingId);
    const link = activeLink(s, buildingId);
    if (!link) raise('no_firm_link');
    Object.assign(link, { status: 'revoked', revoked_by: userId, revoked_at: now() });
    // Pending invitations sent by the firm's staff die with the link, so no personal membership outlives it.
    const staff = new Set(
      s.members
        .filter((m) => m.building_id === buildingId && m.via_link_id === link.id)
        .map((m) => m.user_id),
    );
    for (const i of s.invitations)
      if (
        i.building_id === buildingId &&
        i.accepted_at == null &&
        i.revoked_at == null &&
        staff.has(i.invited_by)
      )
        i.revoked_at = now();
    for (const m of s.members) if (m.via_link_id === link.id) m.status = 'suspended';
    revokeOpenCodes(s, buildingId);
    // Open firm reviews go back to their authors.
    for (const n of s.notices)
      if (n.building_id === buildingId && n.review_by === 'firm' && n.status === 'pending_review') {
        s.comments.push({
          id: newId(),
          building_id: buildingId,
          document_id: n.id,
          author_id: userId,
          body: 'Strata management access was removed, so this review was returned to draft.',
          created_at: now(),
        });
        Object.assign(n, { status: 'draft', review_by: 'building' });
      }
    audit(s, userId, buildingId, 'firm_building_links.update', String(link.id));
    return {};
  });
}
export function acceptFirmCode(s: MockState, userId: string, raw: unknown): Result<{ buildingId: string }> {
  return run(() => {
    const input = acceptInput.parse(raw);
    const code = normalizeCode(input.code);
    if (!code) throw new AppError('invalid_code', 'That code isn’t valid. Check it and try again.');
    const firm = s.organizations.find((o) => o.id === input.firmOrgId && o.kind === 'firm');
    if (
      !firm ||
      !s.orgMembers.some(
        (m) =>
          m.org_id === firm.id &&
          m.user_id === userId &&
          m.status === 'active' &&
          ['org_owner', 'org_admin', 'portfolio_manager'].includes(String(m.role)),
      )
    )
      throw new ForbiddenError();
    const c = s.linkCodes.find((x) => x.code_hash === hashCode(code));
    if (!c || c.used_at != null) raise('invalid_code');
    if (c.kind !== 'firm') raise('wrong_code_kind');
    if (c.revoked_at != null) raise('revoked_code');
    if (new Date(String(c.expires_at)) <= new Date()) raise('expired_code');
    const buildingId = String(c.building_id);
    // An archived building cannot be linked to a firm, even with a still-valid code.
    if (!s.buildings.some((b) => b.id === buildingId)) raise('invalid_code');
    if (activeLink(s, buildingId)) raise('firm_already_linked');
    const link = {
      id: newId(),
      building_id: buildingId,
      firm_org_id: firm.id,
      status: 'active',
      invited_by: c.created_by,
      accepted_by: userId,
      revoked_by: null,
      created_at: now(),
      accepted_at: now(),
      revoked_at: null,
    };
    s.firmLinks.push(link);
    c.used_at = now();
    addLinkMembers(s, link);
    audit(s, userId, buildingId, 'firm_building_links.insert', link.id);
    return { buildingId };
  });
}
