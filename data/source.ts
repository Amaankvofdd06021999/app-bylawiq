import type { Building, Profile, Row } from '@/lib/schema';
import type { Resource } from '@/lib/resources';
import type { BylawMessage } from '@/lib/chat-types';
import type { Source } from '@/lib/ai/citations';
import type { FirmLinkStatus } from '@/features/firm-links/schema';
import type {
  BuildingManagerData,
  FirmOwnerData,
  PlatformAdminData,
  StrataManagerData,
} from '@/features/dashboards/types';
import type { ResidentData } from '@/features/residents/types';
import type { FirmKnowledgeData } from '@/features/knowledge/types';

/**
 * The read side of the app: everything a screen needs, already scoped to the signed-in person.
 *
 * There are two implementations:
 *  - `data/supabase.ts` — the real app. Every read runs as the authenticated user, behind Row Level Security.
 *  - `mock/data-source.ts` — the interactive demo at `/demo`, reading an in-memory store per browser session.
 *
 * Screens (`app/_screens/*`) only ever talk to this interface, so they are written once and render identically
 * for both. The write side is the client-side `Backend` in `components/backend.tsx`.
 *
 * Methods marked "optional feature" return `null` when the source doesn't support that feature yet. The real
 * app has no tables for role dashboards, resident tools or firm knowledge so far (see docs/HANDOFF.md), so
 * `data/supabase.ts` returns `null` for them and the screens fall back to the plain views.
 *
 * Every method throws `UnauthorizedError` when nobody is signed in (screens send them to `signInPath`), and
 * `NotFoundError` for anything outside the person's scope — never another building's data (AGENTS.md §0).
 */
export interface DataSource {
  /** Link prefix for every in-app URL: `${base}/b/${id}/ask`. */
  readonly base: AppBase;
  /** Where someone who isn't signed in is sent. */
  readonly signInPath: string;

  /** The signed-in person, the buildings they can open, their organizations and memberships. */
  workspace(): Promise<WorkspaceData>;
  /** `workspace()` plus one building the person can open, their permissions on it and their navigation. */
  buildingWorkspace(buildingId: string): Promise<BuildingWorkspaceData>;
  /** One building-scoped list, projected to the columns in `lib/resources.ts`. */
  listResource(resource: Resource, buildingId: string): Promise<Row[]>;
  /** One of the person's own conversations and its messages. */
  conversation(chatId: string): Promise<ConversationData>;
  /** What the Ask home needs: ready documents, recent conversations and the ask options. */
  askHome(buildingId: string): Promise<AskHomeData>;
  /** Knowledge layers the person may pick between in a conversation on this building; `undefined` hides the chips. */
  layers(buildingId: string): Promise<Layer[] | undefined>;

  /** The building's strata management firm link, or `null` without `member.read`. */
  firmLinkStatus(buildingId: string): Promise<FirmLinkStatus | null>;
  /** Firms the person can accept a building link code for. */
  firmOrganizations(): Promise<{ id: string; name: string }[]>;
  /** Drafts sent to the person's firm for review. */
  firmReviewInbox(): Promise<ReviewInboxItem[]>;

  /** Where this person's day starts (their home screen). */
  landingPath(): Promise<string>;
  /** Whether the person is a BylawIQ platform admin (no building memberships; home is `${base}/admin`). */
  isPlatformAdmin(): Promise<boolean>;

  /** Optional feature: the platform admin's overview. */
  platformDashboard(): Promise<{ name: string; data: PlatformAdminData } | null>;
  /** Optional feature: the role dashboard on the overview page, or `null` for the plain building list. */
  workspaceDashboard(): Promise<WorkspaceDashboard | null>;
  /** Optional feature: the single-building staff home, or `null` when this person has none. */
  buildingDashboard(buildingId: string): Promise<BuildingManagerData | null>;
  /** Optional feature: a resident's home and paid tools, or `null` when they aren't a resident here. */
  residentHome(buildingId: string): Promise<ResidentData | null>;
  /** Optional feature: the Firm tab of Knowledge, or `null` when this person can't see it on this building. */
  firmKnowledge(buildingId: string): Promise<FirmKnowledgeData | null>;
}

export type AppBase = '' | '/demo';
export type Layer = Source['kind'];

export type WorkspaceData = {
  profile: Profile;
  buildings: Building[];
  organizations: Row[];
  memberships: Row[];
  email: string;
};

export type BuildingWorkspaceData = WorkspaceData & {
  building: Building;
  unreadUpdates: number;
  permissions: string[];
  /** The person reaches this building through a firm link rather than a personal membership. */
  linkedMember: boolean;
  nav: ShellNav;
};

/** Extra navigation for features only some sources have. All `false` shows the standard staff navigation. */
export type ShellNav = {
  /** Show "Home" for the single-building staff dashboard. */
  home: boolean;
  /** Replace the staff navigation with a resident's own. */
  residentNav: boolean;
  /** Show Knowledge (Firm tab) to firm staff who lack `agent.manage`. */
  firmKnowledge: boolean;
};
export const NO_EXTRA_NAV: ShellNav = { home: false, residentNav: false, firmKnowledge: false };

export type ConversationData = {
  chat: {
    id: string;
    building_id: string | null;
    user_id: string;
    title: string;
    scope: 'building' | 'general' | 'portfolio';
    scope_building_ids: string[];
    as_of: string | null;
    source_types: string[];
    agent_deployment_id: string | null;
  };
  messages: BylawMessage[];
};

export type AskHomeData = {
  documents: Row[];
  chats: Row[];
  availableLayers?: Layer[];
  /** A paying resident's balance, checked before a chat is created. */
  wallet?: { freeLeft: number; credits: number };
  /** A resident whose Ask is switched off. */
  askPaused: boolean;
};

export type ReviewInboxItem = {
  id: string;
  building_id: string;
  title: string;
  kind: string;
  created_at: string;
};

export type WorkspaceDashboard =
  { kind: 'firm_owner'; data: FirmOwnerData } | { kind: 'strata_manager'; data: StrataManagerData };
