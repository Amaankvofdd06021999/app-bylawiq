import 'server-only';
import { configured } from '@/lib/env';
import { UnauthorizedError } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import { buildingManagerHome } from '@/features/dashboards/building-home';
import { strataPortfolio } from '@/features/dashboards/portfolio';
import { firmOwnerHome } from '@/features/dashboards/firm-owner';
import * as workspaceQueries from '@/features/workspace/queries';
import * as firmQueries from '@/features/firm-links/queries';
import * as residentQueries from '@/features/residents/queries';
import type { BylawMessage } from '@/lib/chat-types';
import { NO_EXTRA_NAV, type DataSource } from './source';

// The real app's data source. Every read goes through the feature query modules, which run as the signed-in
// user behind Row Level Security — this file only adapts their results to the `DataSource` contract and
// never uses the service-role key (AGENTS.md §0).
//
// Optional features (role dashboards, resident tools, firm knowledge, the platform admin) have no tables yet,
// so they return `null` and the screens show the standard views. To add one: write the migration and its
// pgTAP isolation test, add a query in `features/<name>/queries.ts`, and return its result here. The demo's
// version in `mock/` shows the exact shape and scoping rules each one needs.
function signedIn() {
  // Without a database connection nobody can be signed in; screens send them to the sign-in page, which
  // explains that setup is required.
  if (!configured()) throw new UnauthorizedError();
}

export function supabaseSource(): DataSource {
  const source: DataSource = {
    base: '',
    signInPath: '/login',

    async workspace() {
      signedIn();
      return workspaceQueries.workspace();
    },
    async buildingWorkspace(buildingId) {
      signedIn();
      return { ...(await workspaceQueries.buildingWorkspace(buildingId)), nav: NO_EXTRA_NAV };
    },
    async listResource(resource, buildingId) {
      signedIn();
      return workspaceQueries.listResource(resource, buildingId);
    },
    async conversation(chatId) {
      signedIn();
      const { chat, messages } = await workspaceQueries.conversation(chatId);
      // Message parts are stored as the AI SDK wrote them; the chat UI validates each part as it renders it.
      return { chat, messages: messages as BylawMessage[] };
    },
    async askHome(buildingId) {
      signedIn();
      const [documents, chats] = await Promise.all([
        workspaceQueries.listResource('documents', buildingId),
        workspaceQueries.listResource('chats', buildingId),
      ]);
      // No layer chips: the real chat route answers from building and legal sources with no layer filter yet.
      return { documents, chats, askPaused: false };
    },
    async layers() {
      return undefined;
    },

    async firmLinkStatus(buildingId) {
      signedIn();
      return firmQueries.firmLinkStatus(buildingId);
    },
    async firmOrganizations() {
      signedIn();
      return firmQueries.firmOrganizations();
    },
    async firmReviewInbox() {
      signedIn();
      return firmQueries.firmReviewInbox();
    },

    async landingPath() {
      const { profile, buildings } = await source.workspace();
      return profile.bound_building_id && buildings[0] ? `/b/${buildings[0].id}/ask` : '/workspace';
    },
    async isPlatformAdmin() {
      // TODO: read the `platform_admin` JWT claim (docs/03-RBAC-SECURITY.md) once the admin console exists.
      return false;
    },

    async platformDashboard() {
      // TODO: Implement platform admin dashboard (Phase 5)
      return null;
    },
    async workspaceDashboard() {
      signedIn();
      const user = await requireUser();
      const portfolio = await strataPortfolio(user);
      if (portfolio) return { kind: 'strata_manager' as const, data: portfolio };
      const firm = await firmOwnerHome(user);
      return firm ? { kind: 'firm_owner' as const, data: firm } : null;
    },
    async buildingDashboard(buildingId: string) {
      signedIn();
      return buildingManagerHome(await requireUser(), buildingId);
    },
    async residentHome(buildingId: string) {
      signedIn();
      return residentQueries.residentHome(buildingId);
    },
    async firmKnowledge() {
      signedIn();
      return null;
    },
  };
  return source;
}
