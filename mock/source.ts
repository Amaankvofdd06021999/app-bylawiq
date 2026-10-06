import { z } from 'zod';
import type { Building, Profile, Row } from '@/lib/schema';
import { chatSchema } from '@/lib/schema';
import type { FirmLinkStatus } from '@/features/firm-links/schema';
import { NotFoundError } from '@/lib/errors';
import type { MockState } from './store';
import { PERSONAS } from './personas';
import { permissionsFor } from './permissions';
import { accessibleBuildings, can, canResidentAsk, isLinkedMember, roleIn, visibleDocuments } from './rules';
// Mock equivalent of `features/workspace/queries.ts` + `features/firm-links/queries.ts`. Every function here
// takes `(state,userId,...)` instead of reading the authenticated user off a Supabase client, so it is a pure,
// testable stand-in for the real query that runs behind RLS (see AGENTS.md §0) — the same scoping rules from
// `mock/rules.ts` decide what each caller can see, never the caller's own say-so.
type Chat = z.infer<typeof chatSchema>;
export function workspace(
  s: MockState,
  userId: string,
): { profile: Profile; buildings: Building[]; organizations: Row[]; memberships: Row[]; email: string } {
  const profile = s.profiles.find((p) => p.id === userId);
  if (!profile) throw new NotFoundError();
  const buildings = accessibleBuildings(s, userId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  // Mirrors `org_read`'s `is_org_member`: an active org_members row for that org.
  const organizations = s.organizations.filter((o) =>
    s.orgMembers.some((m) => m.org_id === o.id && m.user_id === userId && m.status === 'active'),
  );
  const memberships = s.members.filter((m) => m.user_id === userId && m.status === 'active');
  const email = PERSONAS.find((p) => p.userId === userId)?.email ?? '';
  return { profile, buildings, organizations, memberships, email };
}
// Copied literally from the column lists in `features/workspace/queries.ts`'s `resources` map — the demo
// projects each row down to exactly these columns, the same way the real `select(...)` does.
const resources = {
  documents: [
    'documents',
    'id,building_id,title,type,status,error_message,effective_date,lto_filing_ref,created_at,byte_size,source_url,knowledge_base_id,parsed_sections,structure_confirmed',
  ],
  agents: [
    'agents',
    'id,building_id,name,description,instructions,status,knowledge_base_id,include_legal,top_k,created_at',
  ],
  knowledge: ['knowledge_bases', 'id,building_id,name,description,created_at'],
  bylaws: ['bylaw_nodes', 'id,building_id,title,section_ref,set_id,created_at'],
  versions: [
    'bylaw_versions',
    'id,building_id,node_id,version,body,rationale,status,effective_date,filing_reference,created_by,review_choice,source_document_id,created_at',
  ],
  notices: [
    'generated_documents',
    'id,building_id,kind,title,body_md,status,review_by,created_by,approved_by,approved_at,sent_at,dispute_id,created_at',
  ],
  comments: ['document_review_comments', 'id,building_id,document_id,author_id,body,created_at'],
  disputes: ['disputes', 'id,building_id,title,reference,category,subject_unit,stage,created_at'],
  events: ['dispute_events', 'id,building_id,dispute_id,stage,occurred_at,logged_at,summary,actor_id'],
  updates: [
    'notifications',
    'id,building_id,type,title,body,severity,target_id,state,snoozed_until,created_at',
  ],
  members: ['building_members', 'id,building_id,user_id,role,status,expires_at'],
  invitations: ['invitations', 'id,building_id,email,role,expires_at,accepted_at,revoked_at,created_at'],
  audit: ['audit_log', 'id,building_id,action,target_id,occurred_at,actor_id'],
  chats: ['chats', 'id,building_id,title,scope,updated_at,archived'],
  deployments: ['agent_deployments', 'id,building_id,agent_id,version,config,created_at'],
} as const;
export type Resource = keyof typeof resources;
// A resource needs this permission to be read at all, mirroring each table's `scoped_read`/`*_read` RLS
// policy. `documents`, `members` and `chats` have their own row-level rule below and are not listed here.
const readPermission: Partial<Record<Resource, string>> = {
  agents: 'chat.use',
  knowledge: 'vault.read',
  bylaws: 'chat.use',
  versions: 'chat.use',
  notices: 'chat.use',
  comments: 'chat.use',
  disputes: 'dispute.read',
  events: 'chat.use',
  updates: 'chat.use',
  invitations: 'member.invite',
  audit: 'audit.read',
  deployments: 'chat.use',
};
function pick(row: Row, cols: readonly string[]): Row {
  const out: Row = { id: row.id };
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}
export function listResource(s: MockState, userId: string, resource: Resource, buildingId: string): Row[] {
  const [, columns] = resources[resource];
  const cols = columns.split(',');
  let rows: Row[];
  if (resource === 'documents') {
    // Mirrors `docs_read`: `vault.read`, and owner-visible only for a resident.
    rows = visibleDocuments(s, userId, buildingId);
  } else {
    const all = s[resource].filter((r) => r.building_id === buildingId);
    if (resource === 'members') {
      // Mirrors `members_read`: your own row, or every row with `member.read`.
      rows = can(s, userId, 'member.read', buildingId) ? all : all.filter((r) => r.user_id === userId);
    } else if (resource === 'chats') {
      // Mirrors `chats_read`: only chats you started, and only with `chat.use` on their building (demo only: or
      // a resident's own building chats while they have paid Ask).
      rows = can(s, userId, 'chat.use', buildingId)
        ? all.filter((r) => r.user_id === userId)
        : canResidentAsk(s, userId, buildingId)
          ? all.filter((r) => r.user_id === userId && r.scope === 'building')
          : [];
    } else {
      const permission = readPermission[resource];
      rows = permission && can(s, userId, permission, buildingId) ? all : [];
    }
  }
  return rows.map((r) => pick(r, cols));
}
export function buildingWorkspace(
  s: MockState,
  userId: string,
  buildingId: string,
): ReturnType<typeof workspace> & {
  building: Building;
  unreadUpdates: number;
  permissions: string[];
  linkedMember: boolean;
} {
  const state = workspace(s, userId);
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) throw new NotFoundError();
  // Mirrors the `notifications` count query: it runs under `scoped_read`, i.e. `chat.use`, so it reads 0
  // rather than erroring when the caller (an owner_resident) lacks that permission.
  const unreadUpdates = can(s, userId, 'chat.use', buildingId)
    ? s.updates.filter((u) => u.building_id === buildingId && u.state === 'new').length
    : 0;
  // `chat.resident` (demo only) is dropped while the platform's resident AI flag is off, so the nav hides Ask.
  const permissions = permissionsFor(roleIn(s, userId, buildingId)).filter(
    (p) => p !== 'chat.resident' || canResidentAsk(s, userId, buildingId),
  );
  const linkedMember = isLinkedMember(s, userId, buildingId);
  return { ...state, building, unreadUpdates, permissions, linkedMember };
}
export function conversation(
  s: MockState,
  userId: string,
  chatId: string,
): { chat: Chat; messages: { id: string; role: 'user' | 'assistant'; parts: unknown[] }[] } {
  const row = s.chats.find((c) => c.id === chatId);
  // Mirrors `chats_read`: only the chat's own user, and only with `chat.use` unless it is a general chat (demo
  // only: or a resident's own building chat while they have paid Ask).
  const accessible =
    row != null &&
    row.user_id === userId &&
    (row.scope === 'general' ||
      can(s, userId, 'chat.use', String(row.building_id)) ||
      (row.scope === 'building' && canResidentAsk(s, userId, String(row.building_id))));
  if (!row || !accessible) throw new NotFoundError();
  const chat = chatSchema.parse(
    pick(row, [
      'id',
      'building_id',
      'user_id',
      'title',
      'scope',
      'scope_building_ids',
      'as_of',
      'source_types',
      'agent_deployment_id',
    ]),
  );
  const messages = s.messages
    .filter((m) => m.chatId === chatId)
    .map((m) => ({ id: m.id, role: m.role, parts: m.parts }));
  return { chat, messages };
}
export function firmLinkStatus(s: MockState, userId: string, buildingId: string): FirmLinkStatus | null {
  // Mirrors `building_firm_status`: the whole row is gated on `member.read`, so it returns no row (null)
  // rather than a 'none' status when the caller lacks that permission — exactly like Priya on Seaside.
  if (!can(s, userId, 'member.read', buildingId)) return null;
  const link = s.firmLinks.find((l) => l.building_id === buildingId && l.status === 'active');
  const org = link ? s.organizations.find((o) => o.id === link.firm_org_id) : undefined;
  const code = s.linkCodes
    .filter(
      (c) =>
        c.building_id === buildingId &&
        c.kind === 'firm' &&
        c.revoked_at == null &&
        c.used_at == null &&
        new Date(String(c.expires_at)) > new Date(),
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const status: FirmLinkStatus['status'] = link ? 'active' : code ? 'invited' : 'none';
  return {
    status,
    firmName: org ? String(org.name) : null,
    since: link ? String(link.accepted_at) : null,
    codeExpiresAt: code ? String(code.expires_at) : null,
  };
}
export function firmOrganizations(s: MockState, userId: string): { id: string; name: string }[] {
  // Mirrors `firmOrganizations`: firm orgs the caller can act for, i.e. holds a manager-level role in.
  const ids = new Set(
    s.orgMembers
      .filter(
        (m) =>
          m.user_id === userId &&
          m.status === 'active' &&
          ['org_owner', 'org_admin', 'portfolio_manager'].includes(String(m.role)),
      )
      .map((m) => m.org_id),
  );
  return s.organizations
    .filter((o) => o.kind === 'firm' && ids.has(o.id))
    .map((o) => ({ id: String(o.id), name: String(o.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function firmReviewInbox(
  s: MockState,
  userId: string,
): { id: string; building_id: string; title: string; kind: string; created_at: string }[] {
  // The real query has no building filter of its own and relies entirely on `scoped_read` (`chat.use`), which
  // a building's own manager also holds — so a raw RLS mirror would wrongly put a building's own pending
  // review in its own manager's inbox. This inbox is for the firm side of that review, so it is scoped the
  // same way `decide_firm_review` gates the decision itself: `review.act` on a building where the caller is
  // a linked firm member (`private.is_linked_member`), not merely a person who can read that building.
  return s.notices
    .filter(
      (n) =>
        n.status === 'pending_review' &&
        n.review_by === 'firm' &&
        can(s, userId, 'review.act', String(n.building_id)) &&
        isLinkedMember(s, userId, String(n.building_id)),
    )
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .slice(0, 50)
    .map((n) => ({
      id: String(n.id),
      building_id: String(n.building_id),
      title: String(n.title),
      kind: String(n.kind),
      created_at: String(n.created_at),
    }));
}
