import 'server-only';
import { configured } from '@/lib/env';
import { launchFeatureEnabled } from '@/lib/launch-scope';
import { UnauthorizedError } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import { buildingManagerHome } from '@/features/dashboards/building-home';
import { strataPortfolio } from '@/features/dashboards/portfolio';
import { firmOwnerHome } from '@/features/dashboards/firm-owner';
import { isPlatformAdminUser, platformAdminHome } from '@/features/dashboards/platform-admin';
import { firmKnowledgeData } from '@/features/knowledge/firm-knowledge-data';
import * as workspaceQueries from '@/features/workspace/queries';
import * as firmQueries from '@/features/firm-links/queries';
import * as residentQueries from '@/features/residents/queries';
import type { BylawMessage } from '@/lib/chat-types';
import type { DataSource, Layer } from './source';

function signedIn() {
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
      const user = await requireUser();
      const baseWorkspace = await workspaceQueries.buildingWorkspace(buildingId);

      // Check if user is a resident
      const { data: member } = await user.client
        .from('building_members')
        .select('role')
        .eq('building_id', buildingId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const isResident = member?.role === 'owner_resident';

      // Check if building is linked to a firm and user is firm staff
      const { data: link } = await user.client
        .from('firm_building_links')
        .select('firm_org_id')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .maybeSingle();

      let isFirmStaff = false;
      if (link?.firm_org_id) {
        const { data: orgMember } = await user.client
          .from('org_members')
          .select('id')
          .eq('org_id', link.firm_org_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        isFirmStaff = Boolean(orgMember);
      }

      return {
        ...baseWorkspace,
        nav: {
          home: !isResident,
          residentNav: isResident,
          firmKnowledge: isFirmStaff,
        },
      };
    },

    async listResource(resource, buildingId) {
      signedIn();
      return workspaceQueries.listResource(resource, buildingId);
    },

    async conversation(chatId) {
      signedIn();
      const { chat, messages } = await workspaceQueries.conversation(chatId);
      return { chat, messages: messages as BylawMessage[] };
    },

    async askHome(buildingId) {
      signedIn();
      const user = await requireUser();
      const [documents, chats] = await Promise.all([
        workspaceQueries.listResource('documents', buildingId),
        workspaceQueries.listResource('chats', buildingId),
      ]);

      const { data: member } = await user.client
        .from('building_members')
        .select('role')
        .eq('building_id', buildingId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const isResident = member?.role === 'owner_resident';

      let wallet = undefined;
      if (isResident) {
        const { data: walletData } = await user.client
          .from('resident_wallets')
          .select('credits')
          .eq('user_id', user.id)
          .eq('building_id', buildingId)
          .maybeSingle();
        wallet = { freeLeft: 3, credits: walletData?.credits ?? 0 };
      }

      return {
        documents,
        chats,
        availableLayers: (isResident ? ['building', 'legal'] : ['building', 'legal', 'firm']) as Layer[],
        wallet,
        askPaused: false,
        askUnavailable: !launchFeatureEnabled('answers'),
      };
    },

    async layers() {
      return ['building', 'legal', 'firm'] as Layer[];
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
      signedIn();
      const user = await requireUser();
      if (await isPlatformAdminUser(user)) return '/admin';
      const { profile, buildings } = await source.workspace();
      if (profile.bound_building_id && buildings[0]) {
        return `/b/${buildings[0].id}/home`;
      }
      return '/workspace';
    },

    async isPlatformAdmin() {
      signedIn();
      const user = await requireUser();
      return isPlatformAdminUser(user);
    },

    async platformDashboard() {
      signedIn();
      const user = await requireUser();
      return platformAdminHome(user);
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

    async firmKnowledge(buildingId: string) {
      signedIn();
      return firmKnowledgeData(await requireUser(), buildingId);
    },
  };

  return source;
}
