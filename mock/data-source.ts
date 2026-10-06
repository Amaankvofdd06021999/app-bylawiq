import 'server-only';
import { UnauthorizedError } from '@/lib/errors';
import type { BylawMessage } from '@/lib/chat-types';
import type { DataSource } from '@/data/source';
import { demoSession } from './session';
import { getStore, type MockState } from './store';
import { landingPath } from './personas';
import { canResidentAsk, firmOf, isPlatformAdmin, layersFor } from './rules';
import * as source from './source';
import {
  buildingManagerDashboard,
  firmOwnerDashboard,
  hasBuildingHome,
  platformDashboard,
  strataManagerDashboard,
} from './dashboards';
import { hasResidentHome, residentData } from './residents';
import { firmKnowledgeView, firmTabFor } from './mutations/firm-knowledge';

// The demo's data source: the same `DataSource` contract as `data/supabase.ts`, answered from this browser's
// in-memory demo store as the persona in its session cookie. The scoping rules live in `mock/rules.ts`, each
// named after the RLS policy or Postgres function it mirrors, so the demo shows exactly what the real app would.
export async function demoSource(): Promise<DataSource> {
  const session = await demoSession();
  const viewer = session ? { s: getStore(session.sessionId), userId: session.persona.userId } : null;
  /** The session's store and person, or `UnauthorizedError` (the screen sends them to the persona picker). */
  function as(): { s: MockState; userId: string } {
    if (!viewer) throw new UnauthorizedError();
    return viewer;
  }
  return {
    base: '/demo',
    signInPath: '/demo',

    async workspace() {
      const { s, userId } = as();
      return source.workspace(s, userId);
    },
    async buildingWorkspace(buildingId) {
      const { s, userId } = as();
      const state = source.buildingWorkspace(s, userId, buildingId);
      return {
        ...state,
        nav: {
          home: state.profile.account_type === 'single_building' && hasBuildingHome(s, userId, buildingId),
          residentNav: hasResidentHome(s, userId, buildingId),
          firmKnowledge: firmTabFor(s, userId, buildingId),
        },
      };
    },
    async listResource(resource, buildingId) {
      const { s, userId } = as();
      return source.listResource(s, userId, resource, buildingId);
    },
    async conversation(chatId) {
      const { s, userId } = as();
      const { chat, messages } = source.conversation(s, userId, chatId);
      return { chat, messages: messages as BylawMessage[] };
    },
    async askHome(buildingId) {
      const { s, userId } = as();
      const resident = hasResidentHome(s, userId, buildingId);
      // A resident's recent list leaves out conversations with no messages (a question that never went through).
      const chats = source
        .listResource(s, userId, 'chats', buildingId)
        .filter((c) => !resident || s.messages.some((m) => m.chatId === c.id));
      return {
        documents: source.listResource(s, userId, 'documents', buildingId),
        chats,
        availableLayers: layersFor(s, userId, buildingId),
        wallet: resident ? residentData(s, userId, buildingId).wallet : undefined,
        askPaused: resident && !canResidentAsk(s, userId, buildingId),
      };
    },
    async layers(buildingId) {
      const { s, userId } = as();
      return layersFor(s, userId, buildingId);
    },

    async firmLinkStatus(buildingId) {
      const { s, userId } = as();
      return source.firmLinkStatus(s, userId, buildingId);
    },
    async firmOrganizations() {
      const { s, userId } = as();
      return source.firmOrganizations(s, userId);
    },
    async firmReviewInbox() {
      const { s, userId } = as();
      return source.firmReviewInbox(s, userId);
    },

    async landingPath() {
      const { s } = as();
      return landingPath(session!.persona, s);
    },
    async isPlatformAdmin() {
      const { s, userId } = as();
      return isPlatformAdmin(s, userId);
    },

    async platformDashboard() {
      const { s, userId } = as();
      return isPlatformAdmin(s, userId)
        ? { name: session!.persona.name, data: platformDashboard(s, userId) }
        : null;
    },
    async workspaceDashboard() {
      const { s, userId } = as();
      const firm = firmOf(s, userId);
      const owner =
        firm != null &&
        s.orgMembers.some(
          (m) => m.user_id === userId && m.org_id === firm && m.role === 'org_owner' && m.status === 'active',
        );
      if (owner) return { kind: 'firm_owner', data: firmOwnerDashboard(s, userId) };
      // A single-building person with no firm only reaches the overview after losing access: the plain list.
      if (firm == null && source.workspace(s, userId).profile.account_type === 'single_building') return null;
      return { kind: 'strata_manager', data: strataManagerDashboard(s, userId) };
    },
    async buildingDashboard(buildingId) {
      const { s, userId } = as();
      return hasBuildingHome(s, userId, buildingId) ? buildingManagerDashboard(s, userId, buildingId) : null;
    },
    async residentHome(buildingId) {
      const { s, userId } = as();
      return hasResidentHome(s, userId, buildingId) ? residentData(s, userId, buildingId) : null;
    },
    async firmKnowledge(buildingId) {
      const { s, userId } = as();
      return firmTabFor(s, userId, buildingId) ? firmKnowledgeView(s, userId) : null;
    },
  };
}
