import type { Row } from '@/lib/schema';
import { checkDb, errorMessage, ForbiddenError } from '@/lib/errors';
import { newId, type MockState } from '../store';
import { can } from '../rules';
// Helpers shared by the pure mock mutations. Every failure goes through the same `lib/errors.ts` mapping the
// real actions use, so the demo shows exactly the messages a real user would see.
export type Result<T extends object> = ({ ok: true } & T) | { ok: false; error: string };
// Mirrors `raise exception '<code>'` in a Postgres function followed by `checkDb` in the action.
export function raise(code: string): never {
  checkDb({ message: code });
  throw new Error(code);
}
export function run<T extends object>(fn: () => T): Result<T> {
  try {
    return { ok: true, ...fn() };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
// Mirrors `lib/auth/guards.ts#requirePermission` (i.e. `public.authorize`).
export function need(s: MockState, userId: string, permission: string, buildingId: string): void {
  if (!can(s, userId, permission, buildingId)) throw new ForbiddenError();
}
// Mirrors `private.is_linked_member` without the active-link check, as `archive_building`/`change_membership` use it.
export function hasLinkRow(s: MockState, userId: string, buildingId: string, activeOnly = false): boolean {
  return s.members.some(
    (m) =>
      m.building_id === buildingId &&
      m.user_id === userId &&
      m.via_link_id != null &&
      (!activeOnly || m.status === 'active'),
  );
}
export function find(rows: Row[], id: unknown): Row | undefined {
  return rows.find((r) => r.id === id);
}
// Soft deletes: the mock readers never see a `deleted_at` row, so the row is dropped instead.
export function drop(rows: Row[], id: unknown): void {
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
}
export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);
export const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
// Mirrors `private.add_link_members`: firm staff join with their firm role; a personal membership is left alone.
export function addLinkMembers(s: MockState, link: Row): void {
  for (const m of s.orgMembers.filter(
    (o) =>
      o.org_id === link.firm_org_id &&
      o.status === 'active' &&
      ['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant'].includes(String(o.role)),
  )) {
    const existing = s.members.find((x) => x.building_id === link.building_id && x.user_id === m.user_id);
    if (!existing)
      s.members.push({
        id: newId(),
        building_id: link.building_id,
        user_id: m.user_id,
        role: m.role,
        status: 'active',
        expires_at: null,
        via_link_id: link.id,
      });
    else if (existing.via_link_id != null)
      Object.assign(existing, { role: m.role, status: 'active', via_link_id: link.id, expires_at: null });
  }
}
