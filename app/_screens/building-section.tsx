import { notFound, redirect } from 'next/navigation';
import type { DataSource } from '@/data/source';
import type { Resource } from '@/lib/resources';
import type { Row } from '@/lib/schema';
import { Shell } from '@/components/shell';
import { Resources } from '@/features/workspace/components/resources';
import { AskHome } from '@/features/chat/components/chat-ui';
import { OrgAccountLinks } from '@/features/members/linked-accounts';
import { StrataManagementCard } from '@/features/firm-links/components/strata-management-card';
import { BuildingManagerDashboard } from '@/features/dashboards/components/building-manager';
import { ResidentHome } from '@/features/residents/components/resident-home';
import { Explainers } from '@/features/residents/components/explainers';
import { DraftNotice } from '@/features/residents/components/draft-notice';
import { ReplyLetter } from '@/features/residents/components/reply-letter';
import { MyDrafts } from '@/features/residents/components/my-drafts';
import { CreditsPage } from '@/features/residents/components/credits-card';
import { FirmKnowledge, KnowledgeTabs } from '@/features/knowledge/components/firm-knowledge';
import { openBuilding } from './guard';

/** The staff sections every building has, in navigation order. */
const STAFF_SECTIONS = [
  'ask',
  'documents',
  'bylaws',
  'notices',
  'disputes',
  'updates',
  'agents',
  'knowledge',
  'members',
  'settings',
  'audit',
] as const;
/** A resident's own paid tools. A 404 for anyone who isn't a resident of the building. */
const RESIDENT_SECTIONS = ['explainers', 'draft', 'reply', 'my-drafts', 'credits'] as const;
type Section = (typeof STAFF_SECTIONS)[number] | (typeof RESIDENT_SECTIONS)[number] | 'home';
const isSection = (s: string): s is Section =>
  s === 'home' || [...STAFF_SECTIONS, ...RESIDENT_SECTIONS].includes(s as never);
const isResidentSection = (s: Section) => (RESIDENT_SECTIONS as readonly string[]).includes(s);

/** The lists each staff section reads. A section not named here reads the list of the same name. */
function resourcesFor(section: Section, permissions: string[]): Resource[] {
  switch (section) {
    case 'bylaws':
      return ['bylaws', 'versions'];
    case 'documents':
    case 'agents':
      return ['documents', 'knowledge', 'agents'];
    case 'knowledge':
      return ['knowledge', 'documents'];
    case 'disputes':
      return ['disputes', 'events'];
    case 'members':
      return permissions.includes('member.invite') ? ['members', 'invitations'] : ['members'];
    case 'notices':
      return ['notices', 'comments'];
    case 'settings':
      return [];
    default:
      return [section as Resource];
  }
}

// One building section (`/b/<id>/<section>`, `/demo/b/<id>/<section>`).
//  - `home`: the single-building staff dashboard, or a resident's home.
//  - resident sections: a resident's paid tools.
//  - `ask`: the Ask home. Every other section: the generic list-and-form view in `Resources`.
// `knowledge` gains a Firm tab for staff of the firm the building is linked to (where the source supports it).
export async function BuildingSectionScreen({
  source,
  params,
  searchParams,
}: {
  source: DataSource;
  params: Promise<{ buildingId: string; section: string }>;
  searchParams: Promise<{ agent?: string; scope?: string; tab?: string; collection?: string }>;
}) {
  const { buildingId, section } = await params;
  if (!isSection(section)) notFound();
  const state = await openBuilding(source, buildingId);
  const shell = {
    profile: state.profile,
    buildings: state.buildings,
    activeId: buildingId,
    permissions: state.permissions,
    unreadUpdates: state.unreadUpdates,
    ...state.nav,
  };

  if (section === 'home' || isResidentSection(section)) {
    const resident = await source.residentHome(buildingId);
    if (resident) {
      const view =
        section === 'explainers' ? (
          <Explainers data={resident} />
        ) : section === 'draft' ? (
          <DraftNotice data={resident} />
        ) : section === 'reply' ? (
          <ReplyLetter data={resident} />
        ) : section === 'my-drafts' ? (
          <MyDrafts data={resident} />
        ) : section === 'credits' ? (
          <CreditsPage data={resident} />
        ) : (
          <ResidentHome data={resident} />
        );
      return <Shell {...shell}>{view}</Shell>;
    }
    if (section !== 'home') notFound();
    // The building home is the single-building view; a multi-building person's home is the overview.
    if (state.profile.account_type !== 'single_building') redirect(source.base + '/workspace');
    const [dashboard, status] = await Promise.all([
      source.buildingDashboard(buildingId),
      source.firmLinkStatus(buildingId),
    ]);
    if (!dashboard) redirect(`${source.base}/b/${buildingId}/documents`);
    return (
      <Shell {...shell}>
        <BuildingManagerDashboard
          data={dashboard}
          firmCard={
            status && (
              <StrataManagementCard
                buildingId={buildingId}
                canManage={state.permissions.includes('building.link_firm')}
                status={status}
              />
            )
          }
        />
      </Shell>
    );
  }

  const { agent, scope, tab, collection } = await searchParams;
  // The Firm tab: only for staff of the firm this building is linked to. Anyone else asking for it gets the
  // building tab, with no hint that firm knowledge exists.
  const firmTab = section === 'knowledge' && state.nav.firmKnowledge;
  if (firmTab && tab === 'firm') {
    const firm = await source.firmKnowledge(buildingId);
    if (firm)
      return (
        <Shell {...shell}>
          <KnowledgeTabs buildingId={buildingId} active="firm" />
          <FirmKnowledge data={firm} initialCollection={collection} />
        </Shell>
      );
  }

  if (section === 'ask') {
    const ask = await source.askHome(buildingId);
    return (
      <Shell {...shell}>
        <AskHome
          {...state}
          documents={ask.documents}
          chats={ask.chats}
          agentId={agent || null}
          availableLayers={ask.availableLayers}
          initialScope={scope === 'portfolio' ? 'portfolio' : undefined}
          wallet={ask.wallet}
          askPaused={ask.askPaused}
        />
      </Shell>
    );
  }

  const lists = await Promise.all(
    resourcesFor(section, state.permissions).map(
      async (r) => [r, await source.listResource(r, buildingId)] as const,
    ),
  );
  const related: Record<string, Row[]> = { ...Object.fromEntries(lists), organizations: state.organizations };
  const firm =
    (section === 'settings' || section === 'notices') && state.permissions.includes('member.read')
      ? await source.firmLinkStatus(buildingId)
      : null;
  return (
    <Shell {...shell}>
      {firmTab && <KnowledgeTabs buildingId={buildingId} active="building" />}
      <Resources
        section={section}
        {...state}
        rows={related[section] || []}
        related={related}
        firmLinked={firm?.status === 'active'}
        accountLinks={
          section === 'members' && state.permissions.includes('org.manage') ? (
            <OrgAccountLinks buildingId={buildingId} />
          ) : undefined
        }
      />
      {section === 'settings' && firm && (
        <div style={{ marginTop: 24 }}>
          <StrataManagementCard
            buildingId={buildingId}
            canManage={state.permissions.includes('building.link_firm')}
            status={firm}
          />
        </div>
      )}
    </Shell>
  );
}
