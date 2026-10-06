import type { Row } from '@/lib/schema';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/constants';
import type {
  AttentionItem,
  BuildingManagerData,
  FirmOwnerData,
  Health,
  PlatformAdminData,
  StrataManagerData,
} from '@/features/dashboards/types';
import type { MockState } from './store';
import { FIRM_COLLECTIONS } from './data/firm-knowledge';
import {
  accessibleBuildings,
  can,
  firmOf,
  isLinkedMember,
  isPlatformAdmin,
  linkedFirmId,
  roleIn,
} from './rules';
import { firmReviewInbox, listResource } from './source';
// Pure builders for the role home screens: `(state,userId,…,now)` → the prop types in features/dashboards/types.ts.
// Building data is read through `listResource`/`can` as the person, so a dashboard shows exactly what that
// person's section pages would (AGENTS.md §0) — never another building's rows, and never firm knowledge to
// anyone who is not staff of that firm. The platform admin gets aggregates only: counts, sums and names.
const DAY = 86400000;
const name = (s: MockState, userId: unknown) =>
  s.profiles.find((p) => p.id === userId)?.display_name ?? 'Someone';
const first = (s: MockState, userId: string) => name(s, userId).split(' ')[0] || 'there';
const roleLabel = (r: unknown) => ROLE_LABELS[String(r) as keyof typeof ROLE_LABELS] ?? String(r);
const time = (v: unknown) => new Date(String(v)).getTime();
const latest = (values: unknown[]) =>
  values
    .filter((v) => v != null)
    .map(String)
    .sort()
    .at(-1) ?? null;
const PROCESSING = ['uploaded', 'scanning', 'parsing', 'chunking', 'embedding'];
// Direct staff of a building (not residents, not firm staff joined through a link) — the building plan's seats.
const buildingSeats = (s: MockState, buildingId: string) =>
  s.members.filter(
    (m) =>
      m.building_id === buildingId &&
      m.status === 'active' &&
      m.via_link_id == null &&
      m.role !== 'owner_resident',
  ).length;
const firmSeats = (s: MockState, orgId: string) =>
  s.orgMembers.filter((m) => m.org_id === orgId && m.status === 'active').length;
/** Disputes the person may read, with the mock-only deadline fields (see mock/data/disputes.ts). Gated by the
 * same `dispute.read` the disputes section uses. */
function disputesFor(s: MockState, userId: string, buildingId: string): Row[] {
  return can(s, userId, 'dispute.read', buildingId)
    ? s.disputes.filter(
        (d) => d.building_id === buildingId && !['resolved', 'withdrawn'].includes(String(d.stage)),
      )
    : [];
}
const daysUntil = (date: unknown, now: Date) => Math.ceil((time(date) - now.getTime()) / DAY);
const dueSoon = (d: Row, now: Date) => d.next_deadline != null && daysUntil(d.next_deadline, now) <= 14;
/** One building's health as this person sees it: red for an overdue deadline or a failed document, warning
 * for anything waiting, green when nothing is. */
function healthOf(s: MockState, userId: string, buildingId: string, now: Date): Health {
  const docs = listResource(s, userId, 'documents', buildingId),
    notices = listResource(s, userId, 'notices', buildingId);
  const issues: string[] = [];
  let red = false;
  const failed = docs.filter((d) => d.status === 'failed').length;
  if (failed) {
    red = true;
    issues.push(`${failed} document${failed > 1 ? 's' : ''} failed to process`);
  }
  const review = docs.filter((d) => d.status === 'review').length;
  if (review) issues.push(`${review} document${review > 1 ? 's' : ''} awaiting a human check`);
  const pending = notices.filter((n) => n.status === 'pending_review').length;
  if (pending) issues.push(`${pending} draft${pending > 1 ? 's' : ''} waiting for review`);
  const changes = notices.filter((n) => n.status === 'changes_requested').length;
  if (changes) issues.push(`${changes} draft${changes > 1 ? 's' : ''} with changes requested`);
  for (const d of disputesFor(s, userId, buildingId))
    if (dueSoon(d, now)) {
      const n = daysUntil(d.next_deadline, now);
      if (n < 0) red = true;
      issues.push(
        n < 0
          ? `A dispute deadline passed ${-n} days ago`
          : `A dispute deadline is in ${n} day${n === 1 ? '' : 's'}`,
      );
    }
  return red
    ? { tone: 'red', label: 'Action needed', issues }
    : issues.length
      ? { tone: 'warning', label: 'Needs attention', issues }
      : { tone: 'green', label: 'On track', issues };
}
function firmKnowledge(s: MockState, orgId: string) {
  const docs = s.firmDocs.filter((d) => d.orgId === orgId);
  return {
    docs,
    collections: FIRM_COLLECTIONS.map((c) => ({
      id: c.id,
      label: c.label,
      count: docs.filter((d) => d.collection === c.id).length,
    })),
  };
}
// A person's most recent trace in the store: audit rows, review comments, approvals and firm documents they wrote.
function lastActive(s: MockState, userId: string): string | null {
  return latest([
    ...s.audit.filter((a) => a.actor_id === userId).map((a) => a.occurred_at),
    ...s.comments.filter((c) => c.author_id === userId).map((c) => c.created_at),
    ...s.notices.filter((n) => n.approved_by === userId).map((n) => n.approved_at),
    ...s.firmDocs.filter((d) => d.created_by === userId).map((d) => d.updated_at),
  ]);
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b),
    m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function platformDashboard(s: MockState, userId: string, now = new Date()): PlatformAdminData {
  if (!isPlatformAdmin(s, userId)) throw new ForbiddenError();
  const p = s.platform;
  const orgName = (id: unknown) => String(s.organizations.find((o) => o.id === id)?.name ?? 'Unknown');
  const customers = p.plans.map((c) => {
    const building = s.buildings.find((b) => b.org_id === c.org_id);
    return {
      id: String(c.id),
      name: String(c.customer),
      kind: c.kind === 'firm' ? ('firm' as const) : ('building' as const),
      plan: String(c.plan_label),
      listPrice: Number(c.list_price),
      price: Number(c.price),
      launchDiscount: c.launch_discount === true,
      seatsUsed:
        c.kind === 'firm' ? firmSeats(s, String(c.org_id)) : building ? buildingSeats(s, building.id) : 0,
      seatsIncluded: Number(c.seats_included),
      mrr: Number(c.mrr),
      status: c.status === 'trial' ? ('trial' as const) : ('active' as const),
      billedTo: c.billed_to ? orgName(c.billed_to) : null,
      since: String(c.since),
    };
  });
  const paying = customers.filter((c) => c.mrr > 0);
  const month = now.toISOString().slice(0, 7),
    usage = p.usage.filter((x) => x.month === month).length
      ? p.usage.filter((x) => x.month === month)
      : p.usage;
  const questions = usage.reduce((n, x) => n + Number(x.questions), 0),
    noGrounding = usage.reduce((n, x) => n + Number(x.no_grounding), 0);
  const docs = s.documents;
  return {
    month: String(usage[0]?.month ?? month),
    revenue: {
      mrr: paying.reduce((n, c) => n + c.mrr, 0),
      listMrr: paying.reduce((n, c) => n + c.listPrice, 0),
      launchMrr: paying.filter((c) => c.launchDiscount).reduce((n, c) => n + c.mrr, 0),
      launchCustomers: paying.filter((c) => c.launchDiscount).length,
      creditSales: usage.reduce((n, x) => n + Number(x.resident_credit_sales), 0),
      payingCustomers: paying.length,
      trials: customers.filter((c) => c.status === 'trial').length,
    },
    customers,
    usage: {
      questions,
      noGrounding,
      noGroundingRate: questions ? noGrounding / questions : 0,
      estCostUsd: usage.reduce((n, x) => n + Number(x.est_cost_usd), 0),
      top: [...usage]
        .sort((a, b) => Number(b.questions) - Number(a.questions))
        .slice(0, 5)
        .map((x) => ({
          buildingId: String(x.building_id),
          name: s.buildings.find((b) => b.id === x.building_id)?.name ?? 'Unknown building',
          questions: Number(x.questions),
          noGroundingRate: Number(x.questions) ? Number(x.no_grounding) / Number(x.questions) : 0,
        })),
    },
    // Counts only — never a title or passage from a building's documents.
    knowledge: {
      failed: docs.filter((d) => d.status === 'failed').length,
      processing: docs.filter((d) => PROCESSING.includes(String(d.status))).length,
      awaitingReview: docs.filter((d) => d.status === 'review').length,
      bylawsUnconfirmed: docs.filter((d) => d.type === 'bylaws' && d.structure_confirmed === false).length,
      legalPassages: s.legalChunks.length,
      legalUpdatedAt: latest(s.legalChunks.map((c) => c.updated_at)),
    },
    flags: { residentAi: p.flags.residentAi },
    audit: [...p.audit]
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
      .slice(0, 8)
      .map((a) => ({
        id: String(a.id),
        at: String(a.occurred_at),
        actor: name(s, a.actor_id),
        summary: String(a.summary ?? a.action),
      })),
  };
}

export function firmOwnerDashboard(s: MockState, userId: string, now = new Date()): FirmOwnerData {
  const orgId = firmOf(s, userId);
  if (!orgId) throw new ForbiddenError();
  const org = s.organizations.find((o) => o.id === orgId)!;
  const mine = accessibleBuildings(s, userId).sort((a, b) => a.name.localeCompare(b.name));
  const buildingName = (id: unknown) => mine.find((b) => b.id === id)?.name ?? 'Building';
  const inbox = firmReviewInbox(s, userId);
  const staff = s.orgMembers
    .filter((m) => m.org_id === orgId && m.status === 'active')
    .map((m) => {
      const id = String(m.user_id);
      return {
        userId: id,
        name: name(s, id),
        role: roleLabel(m.role),
        buildings: accessibleBuildings(s, id).filter(
          (b) => isLinkedMember(s, id, b.id) && linkedFirmId(s, b.id) === orgId,
        ).length,
        openReviews: firmReviewInbox(s, id).length,
        lastActive: lastActive(s, id),
        you: id === userId,
      };
    });
  const order = ['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant'];
  staff.sort(
    (a, b) =>
      order.indexOf(String(s.orgMembers.find((m) => m.user_id === a.userId && m.org_id === orgId)?.role)) -
        order.indexOf(String(s.orgMembers.find((m) => m.user_id === b.userId && m.org_id === orgId)?.role)) ||
      a.name.localeCompare(b.name),
  );
  const roster = mine
    .filter((b) => isLinkedMember(s, userId, b.id) && linkedFirmId(s, b.id) === orgId)
    .map((b) => {
      const link = s.firmLinks.find((l) => l.building_id === b.id && l.status === 'active');
      return {
        buildingId: b.id,
        name: b.name,
        linked: link != null,
        since: link ? String(link.accepted_at) : null,
        health: healthOf(s, userId, b.id, now),
        openDisputes: disputesFor(s, userId, b.id).length,
        pendingReviews: inbox.filter((i) => i.building_id === b.id).length,
      };
    });
  // Decided firm reviews: approvals (created → approved) and change requests (created → the firm's first comment).
  const hours: number[] = [];
  for (const b of roster)
    for (const n of listResource(s, userId, 'notices', b.buildingId)) {
      if (n.review_by !== 'firm') continue;
      if (n.approved_at) hours.push((time(n.approved_at) - time(n.created_at)) / 3600000);
      else if (n.status === 'changes_requested') {
        const c = listResource(s, userId, 'comments', b.buildingId)
          .filter((c) => c.document_id === n.id)
          .map((c) => String(c.created_at))
          .sort()[0];
        if (c) hours.push((time(c) - time(n.created_at)) / 3600000);
      }
    }
  const oldest = inbox[0];
  const { docs, collections } = firmKnowledge(s, orgId);
  const plan = s.platform.plans.find((p) => p.org_id === orgId);
  const invitations = mine.flatMap((b) =>
    listResource(s, userId, 'invitations', b.id)
      .filter((i) => i.accepted_at == null && i.revoked_at == null && time(i.expires_at) > now.getTime())
      .map((i) => ({
        id: String(i.id),
        buildingId: b.id,
        buildingName: b.name,
        email: String(i.email),
        role: roleLabel(i.role),
        expiresAt: String(i.expires_at),
      })),
  );
  // Unused firm link codes on buildings the owner can already see (a code for a building the firm isn't in yet
  // is held by that building, so it can't appear here; it is redeemed through "Join a building").
  const codes = s.linkCodes
    .filter(
      (c) =>
        mine.some((b) => b.id === c.building_id) &&
        can(s, userId, 'member.read', String(c.building_id)) &&
        c.kind === 'firm' &&
        c.used_at == null &&
        c.revoked_at == null &&
        time(c.expires_at) > now.getTime(),
    )
    .map((c) => ({
      id: String(c.id),
      buildingId: String(c.building_id),
      buildingName: buildingName(c.building_id),
      expiresAt: String(c.expires_at),
    }));
  return {
    firstName: first(s, userId),
    firm: { id: orgId, name: String(org.name) },
    staff,
    roster,
    turnaround: {
      medianHours: median(hours),
      decided: hours.length,
      waiting: inbox.length,
      oldest: oldest
        ? {
            id: oldest.id,
            title: oldest.title,
            buildingId: oldest.building_id,
            buildingName: buildingName(oldest.building_id),
            days: Math.floor((now.getTime() - time(oldest.created_at)) / DAY),
          }
        : null,
    },
    knowledge: {
      total: docs.length,
      collections,
      lastUpdated: latest(docs.map((d) => d.updated_at)),
      buildingId: roster[0]?.buildingId ?? null,
    },
    plan: plan
      ? {
          label: String(plan.plan_label),
          listPrice: Number(plan.list_price),
          price: Number(plan.price),
          launchDiscount: plan.launch_discount === true,
          seatsIncluded: Number(plan.seats_included),
          seatsUsed: firmSeats(s, orgId),
          buildings: roster.length,
          status: String(plan.status),
        }
      : null,
    invitations,
    codes,
  };
}

// "Needs attention today" is ordered by urgency across buildings, never by building name: dispute deadlines
// (soonest first), then reviews waiting on her (longest waiting first), approved notices not yet sent (longest
// since approval first), then law changes (newest first). `at` is the sort time within each kind.
const ATTENTION_ORDER: AttentionItem['kind'][] = ['deadline', 'review', 'unsent', 'law'];
export function strataManagerDashboard(s: MockState, userId: string, now = new Date()): StrataManagerData {
  const orgId = firmOf(s, userId);
  const mine = accessibleBuildings(s, userId).sort((a, b) => a.name.localeCompare(b.name));
  const items: (AttentionItem & { at: number })[] = [];
  for (const b of mine)
    for (const d of disputesFor(s, userId, b.id).filter((d) => dueSoon(d, now))) {
      const n = daysUntil(d.next_deadline, now);
      items.push({
        at: time(d.next_deadline),
        id: 'deadline:' + d.id,
        kind: 'deadline',
        title: String(d.title),
        detail: `${d.deadline_label ?? 'Deadline'} ${n < 0 ? `— overdue by ${-n} days` : n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`} (${String(d.next_deadline).slice(0, 10)})`,
        buildingId: b.id,
        buildingName: b.name,
        section: 'disputes',
        tone: n <= 3 ? 'red' : 'warning',
      });
    }
  for (const r of firmReviewInbox(s, userId)) {
    const days = Math.floor((now.getTime() - time(r.created_at)) / DAY);
    items.push({
      at: time(r.created_at),
      id: 'review:' + r.id,
      kind: 'review',
      title: r.title,
      detail: `Waiting for your review · ${days} day${days === 1 ? '' : 's'}`,
      buildingId: r.building_id,
      buildingName: mine.find((b) => b.id === r.building_id)?.name ?? null,
      section: 'notices',
      tone: 'blue',
    });
  }
  for (const b of mine)
    for (const n of listResource(s, userId, 'notices', b.id).filter(
      (n) => n.status === 'approved' && !n.sent_at,
    ))
      items.push({
        at: time(n.approved_at ?? n.created_at),
        id: 'unsent:' + n.id,
        kind: 'unsent',
        title: String(n.title),
        detail: `Approved ${String(n.approved_at ?? '').slice(0, 10)} · not sent yet`,
        buildingId: b.id,
        buildingName: b.name,
        section: 'notices',
        tone: 'warning',
      });
  // Law changes: the firm's CRT & legislation tracker entries updated in the last 45 days apply to every linked building.
  const linked = mine.filter(
    (b) => orgId && isLinkedMember(s, userId, b.id) && linkedFirmId(s, b.id) === orgId,
  );
  if (orgId && linked.length)
    for (const d of s.firmDocs.filter(
      (d) =>
        d.orgId === orgId &&
        d.collection === 'legal_tracker' &&
        now.getTime() - time(d.updated_at) <= 45 * DAY,
    ))
      items.push({
        at: -time(d.updated_at),
        id: 'law:' + d.id,
        kind: 'law',
        title: d.title,
        detail: `Updated ${d.updated_at.slice(0, 10)} · affects ${linked.length === mine.length ? 'all' : linked.length} of your buildings`,
        buildingId: linked[0].id,
        buildingName: null,
        section: 'knowledge',
        tone: 'neutral',
      });
  const knowledge =
    orgId && linked.length
      ? (() => {
          const { docs, collections } = firmKnowledge(s, orgId);
          const label = (c: string) => FIRM_COLLECTIONS.find((x) => x.id === c)?.label ?? c;
          return {
            collections,
            recent: [...docs]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 4)
              .map((d) => ({ id: d.id, title: d.title, collection: label(d.collection) })),
            buildingId: linked[0].id,
          };
        })()
      : null;
  const askFrom = mine.find((b) => can(s, userId, 'chat.use_portfolio', b.id));
  return {
    firstName: first(s, userId),
    knowledge,
    needsAttention: items
      .sort((x, y) => ATTENTION_ORDER.indexOf(x.kind) - ATTENTION_ORDER.indexOf(y.kind) || x.at - y.at)
      .map((x) => {
        const item: AttentionItem & { at?: number } = { ...x };
        delete item.at;
        return item;
      }),
    buildings: mine.map((b) => {
      const notices = listResource(s, userId, 'notices', b.id);
      return {
        id: b.id,
        name: b.name,
        address: b.address ?? null,
        units: b.unit_count ?? null,
        health: healthOf(s, userId, b.id, now),
        reviews: notices.filter((n) => n.status === 'pending_review').length,
        disputes: disputesFor(s, userId, b.id).length,
        drafts: notices.filter((n) => !n.sent_at && n.status !== 'sent').length,
        updates: listResource(s, userId, 'updates', b.id).filter((u) => u.state === 'new').length,
      };
    }),
    askAcross: askFrom && mine.length > 1 ? { buildingId: askFrom.id, count: mine.length } : null,
  };
}

// A readable, stable demo code residents would use to join (no real join-by-code flow for residents yet).
const residentCode = (name: string, plan: string | null) =>
  name
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 4)
    .toUpperCase() +
  '-' +
  ((plan ?? '').replace(/\D/g, '') || '0000');
export function buildingManagerDashboard(
  s: MockState,
  userId: string,
  buildingId: string,
  now = new Date(),
): BuildingManagerData {
  const b = accessibleBuildings(s, userId).find((x) => x.id === buildingId);
  if (!b || isPlatformAdmin(s, userId)) throw new NotFoundError();
  const docs = listResource(s, userId, 'documents', buildingId),
    notices = listResource(s, userId, 'notices', buildingId),
    comments = listResource(s, userId, 'comments', buildingId);
  const versions = listResource(s, userId, 'versions', buildingId);
  const health = healthOf(s, userId, buildingId, now);
  const ready = docs.filter((d) => d.status === 'ready').length,
    inForce = versions.filter((v) => v.status === 'in_force').length,
    draftBylaws = versions.filter((v) => v.status === 'draft').length;
  const firmId = linkedFirmId(s, buildingId);
  const firmName =
    firmId && can(s, userId, 'member.read', buildingId)
      ? String(s.organizations.find((o) => o.id === firmId)?.name ?? '')
      : null;
  const plan = s.platform.plans.find((p) => p.org_id === b.org_id);
  const members = listResource(s, userId, 'members', buildingId);
  const statusOf = (n: Row) =>
    (n.sent_at ? 'sent' : String(n.status)) as BuildingManagerData['drafts'][number]['status'];
  return {
    firstName: first(s, userId),
    building: {
      id: b.id,
      name: b.name,
      address: b.address ?? null,
      units: b.unit_count ?? null,
      strataPlan: b.strata_plan_no ?? null,
    },
    health: {
      ...health,
      checks: [
        { label: 'Documents ready to search', ok: ready > 0, detail: `${ready} of ${docs.length}` },
        {
          label: 'Documents awaiting a human check',
          ok: !docs.some((d) => d.status === 'review'),
          detail: String(docs.filter((d) => d.status === 'review').length),
        },
        { label: 'Bylaws in force', ok: inForce > 0, detail: `${inForce} in force · ${draftBylaws} draft` },
        { label: 'Strata management firm', ok: firmId != null, detail: firmName || 'Not connected' },
      ],
    },
    drafts: notices
      .filter((n) => n.status !== 'sent' && !n.sent_at)
      .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))
      .map((n) => ({
        id: String(n.id),
        title: String(n.title),
        kind: String(n.kind),
        status: statusOf(n),
        reviewBy: String(n.review_by ?? 'building'),
        note:
          n.status === 'changes_requested'
            ? String(
                comments
                  .filter((c) => c.document_id === n.id)
                  .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0]?.body ?? '',
              ) || null
            : null,
        updatedAt: String(n.approved_at ?? n.created_at),
      })),
    council: {
      updates: listResource(s, userId, 'updates', buildingId)
        .filter((u) => u.state === 'new')
        .map((u) => ({
          id: String(u.id),
          title: String(u.title),
          severity: String(u.severity),
          at: String(u.created_at),
        })),
      disputes: disputesFor(s, userId, buildingId).map((d) => ({
        id: String(d.id),
        title: String(d.title),
        reference: String(d.reference),
        stage: String(d.stage),
        deadline: d.next_deadline ? String(d.next_deadline) : null,
        deadlineLabel: d.deadline_label ? String(d.deadline_label) : null,
      })),
    },
    residents: {
      count: members.filter((m) => m.role === 'owner_resident' && m.status === 'active').length,
      code: residentCode(b.name, b.strata_plan_no ?? null),
    },
    plan: plan
      ? {
          label: String(plan.plan_label),
          price: Number(plan.price),
          listPrice: Number(plan.list_price),
          seatsIncluded: Number(plan.seats_included),
          seatsUsed: buildingSeats(s, buildingId),
          billedBy: plan.billed_to
            ? String(s.organizations.find((o) => o.id === plan.billed_to)?.name ?? '')
            : null,
        }
      : {
          label: 'No plan on file',
          price: 0,
          listPrice: 0,
          seatsIncluded: 0,
          seatsUsed: buildingSeats(s, buildingId),
          billedBy: null,
        },
    firmName,
    can: {
      draft: can(s, userId, 'document.draft', buildingId),
      ask: can(s, userId, 'chat.use', buildingId),
      upload: can(s, userId, 'vault.upload', buildingId),
      invite: can(s, userId, 'member.invite', buildingId),
    },
  };
}
// Whether `/demo/b/<id>/home` is the building manager dashboard: staff with Ask. A resident gets their own home
// instead (mock/residents.ts#hasResidentHome); anyone else is sent to documents.
export function hasBuildingHome(s: MockState, userId: string, buildingId: string): boolean {
  return roleIn(s, userId, buildingId) != null && can(s, userId, 'chat.use', buildingId);
}
