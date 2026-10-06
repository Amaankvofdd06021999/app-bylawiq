import { z } from 'zod';
import type { Row } from '@/lib/schema';
import { ForbiddenError } from '@/lib/errors';
import { audit, newId, type MockState } from '../store';
import { can, canResidentAsk } from '../rules';
import { need, now, raise, run, type Result } from './shared';
// Mirrors features/chat/actions.ts: the `chats_insert` policy, `public.can_use_chat` and `public.branch_chat`.
const createInput = z.object({
  buildingId: z.uuid().nullable(),
  scope: z.enum(['building', 'general', 'portfolio']).default('building'),
  buildingIds: z.array(z.uuid()).max(30).default([]),
  asOf: z.iso.date().nullable().default(null),
  sourceTypes: z.array(z.string()).max(10).default([]),
  agentId: z.uuid().nullable().default(null),
});
export function createChat(s: MockState, userId: string, raw: unknown): Result<{ id: string }> {
  return run(() => {
    const v = createInput.parse(raw);
    // Demo only: a resident with paid Ask (`canResidentAsk`) may start a building-scoped chat on their building.
    const resident =
      v.scope === 'building' &&
      v.buildingId != null &&
      !can(s, userId, 'chat.use', v.buildingId) &&
      canResidentAsk(s, userId, v.buildingId);
    if (v.buildingId && !resident)
      need(s, userId, v.scope === 'portfolio' ? 'chat.use_portfolio' : 'chat.use', v.buildingId);
    for (const b of v.buildingIds) need(s, userId, 'chat.use_portfolio', b);
    // `chats_insert`: anything but a general chat needs `chat.use` on its building.
    if (v.scope !== 'general' && !resident && !(v.buildingId && can(s, userId, 'chat.use', v.buildingId)))
      throw new ForbiddenError();
    let deployment: string | null = null;
    if (v.agentId) {
      const d = s.deployments
        .filter((x) => x.agent_id === v.agentId && x.building_id === v.buildingId)
        .sort((a, b) => Number(b.version) - Number(a.version))[0];
      if (!d) raise('deployment_not_found');
      deployment = String(d.id);
    }
    const id = newId();
    const buildingId = v.scope === 'general' ? null : v.buildingId;
    // A general chat's `building_id` is a real null (as `chatSchema` expects), which `Row`'s optional id can't express.
    const row: Record<string, unknown> = {
      id,
      building_id: buildingId,
      user_id: userId,
      title: 'New conversation',
      scope: v.scope,
      scope_building_ids: v.scope === 'portfolio' ? v.buildingIds : [],
      as_of: v.asOf,
      source_types: v.sourceTypes,
      agent_deployment_id: deployment,
      parent_chat_id: null,
      updated_at: now(),
      archived: false,
    };
    s.chats.push(row as Row);
    audit(s, userId, buildingId, 'chats.insert', id);
    return { id };
  });
}
// Mirrors `public.can_use_chat`, plus (demo only) a resident's own building chat while `canResidentAsk` holds.
export function canUseChat(s: MockState, userId: string, chatId: unknown): boolean {
  const c = s.chats.find((x) => x.id === chatId);
  if (!c || c.user_id !== userId) return false;
  if (c.scope === 'general') return true;
  if (c.scope === 'building' && isResidentAsker(s, userId, String(c.building_id))) return true;
  if (!can(s, userId, 'chat.use', String(c.building_id))) return false;
  const ids = Array.isArray(c.scope_building_ids) ? c.scope_building_ids.map(String) : [];
  return (
    c.scope !== 'portfolio' || (ids.length > 0 && ids.every((b) => can(s, userId, 'chat.use_portfolio', b)))
  );
}
export function branchChat(s: MockState, userId: string, raw: unknown): Result<{ id: string }> {
  return run(() => {
    const v = z.object({ chatId: z.uuid(), messageId: z.uuid() }).parse(raw);
    if (!canUseChat(s, userId, v.chatId)) raise('forbidden');
    const c = s.chats.find((x) => x.id === v.chatId);
    const history = s.messages.filter((m) => m.chatId === v.chatId);
    const cut = history.findIndex((m) => m.id === v.messageId && m.role === 'user');
    if (!c || cut < 0) raise('not_found');
    const id = newId();
    s.chats.push({
      ...c,
      id,
      user_id: userId,
      title: String(c.title) + ' · branch',
      parent_chat_id: c.id,
      updated_at: now(),
      archived: false,
    });
    // Everything before the chosen question is copied; the question itself is asked again in the branch.
    for (const m of history.slice(0, cut))
      s.messages.push({ ...m, id: newId(), chatId: id, parts: structuredClone(m.parts) });
    audit(s, userId, c.building_id ?? null, 'chats.insert', id);
    return { id };
  });
}
// --- Demo v2: resident Ask and credits (no production equivalent; TODO(legal): needs sign-off first). ---
/** A person who asks on this building as a paying resident: no staff `chat.use`, but `canResidentAsk`. */
export function isResidentAsker(s: MockState, userId: string, buildingId: string): boolean {
  return !can(s, userId, 'chat.use', buildingId) && canResidentAsk(s, userId, buildingId);
}
export const FREE_QUESTIONS = 2;
/** Charges one resident question: a free question while any are left, otherwise 1 credit. Returns the ledger
 * entry's id, or null (changing nothing) when the resident has neither, so the caller can show the paywall. */
export function spendQuestion(s: MockState, userId: string, buildingId: string): string | null {
  let w = s.wallets.find((x) => x.userId === userId && x.buildingId === buildingId);
  if (!w) {
    w = { userId, buildingId, credits: 0, freeQuestionsUsed: 0 };
    s.wallets.push(w);
  }
  const free = w.freeQuestionsUsed < FREE_QUESTIONS;
  if (!free && w.credits < 1) return null;
  if (free) w.freeQuestionsUsed++;
  else w.credits--;
  const id = newId();
  s.ledger.push({
    id,
    userId,
    buildingId,
    delta: free ? 0 : -1,
    reason: free ? 'free_question' : 'question',
    at: now(),
  });
  return id;
}
/** Reverses a question charge (the answer found no grounding): the credit or free question comes back and the
 * ledger entry is removed, so the history only shows questions that were answered. */
export function refundQuestion(s: MockState, entryId: string): void {
  const i = s.ledger.findIndex((e) => e.id === entryId);
  if (i < 0) return;
  const e = s.ledger[i];
  const w = s.wallets.find((x) => x.userId === e.userId && x.buildingId === e.buildingId);
  if (w) {
    if (e.reason === 'free_question') w.freeQuestionsUsed = Math.max(0, w.freeQuestionsUsed - 1);
    else w.credits -= e.delta;
  }
  s.ledger.splice(i, 1);
}
