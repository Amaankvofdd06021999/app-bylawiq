import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import type { FirmKnowledgeData, FirmCollectionId, FirmDocView } from './types';

export async function firmKnowledgeData(
  user: SessionUser,
  buildingId: string,
): Promise<FirmKnowledgeData | null> {
  // 1. Get linked firm for building
  const { data: link, error: linkError } = await user.client
    .from('firm_building_links')
    .select('firm_org_id')
    .eq('building_id', buildingId)
    .eq('status', 'active')
    .maybeSingle();

  if (linkError || !link?.firm_org_id) return null;

  // 2. Check if user is an active member of this firm
  const { data: member, error: memberError } = await user.client
    .from('org_members')
    .select('role')
    .eq('org_id', link.firm_org_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member) return null;

  const { data: org } = await user.client
    .from('organizations')
    .select('id, name')
    .eq('id', link.firm_org_id)
    .maybeSingle();

  const canEdit = ['org_owner', 'org_admin', 'portfolio_manager'].includes(member.role);

  // 3. Fetch firm documents
  const { data: docs, error: docsError } = await user.client
    .from('firm_documents')
    .select('id, title, doc_kind, created_at, updated_at, description')
    .eq('firm_id', link.firm_org_id)
    .order('updated_at', { ascending: false });

  checkDb(docsError);

  const formatDoc = (
    d: {
      id: string;
      title: string;
      doc_kind: string;
      created_at: string;
      updated_at: string;
      description: string | null;
    },
    collection: FirmCollectionId,
  ): FirmDocView => ({
    id: d.id,
    collection,
    title: d.title,
    body: d.description || '',
    parts: 1,
    updatedAt: d.updated_at ? d.updated_at.slice(0, 10) : '2026-10-01',
    author: 'Firm Staff',
  });

  const allDocs = docs || [];

  return {
    firm: { id: org?.id || link.firm_org_id, name: org?.name || 'Firm' },
    canEdit,
    collections: [
      {
        id: 'templates',
        label: 'Notice and bylaw templates',
        docs: allDocs
          .filter((d) => d.doc_kind === 'template')
          .map((d) => formatDoc(d, 'templates')),
      },
      {
        id: 'policies',
        label: 'Internal policy',
        docs: allDocs
          .filter((d) => d.doc_kind === 'policy')
          .map((d) => formatDoc(d, 'policies')),
      },
      {
        id: 'guidance',
        label: 'Staff guidance',
        docs: allDocs
          .filter((d) => d.doc_kind === 'guide')
          .map((d) => formatDoc(d, 'guidance')),
      },
      {
        id: 'legal_tracker',
        label: 'CRT and legislation tracker',
        docs: allDocs
          .filter((d) => ['precedent', 'research'].includes(d.doc_kind))
          .map((d) => formatDoc(d, 'legal_tracker')),
      },
    ],
  };
}
