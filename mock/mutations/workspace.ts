import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Row } from '@/lib/schema';
import { AppError, ForbiddenError } from '@/lib/errors';
import { mutationSchema, values } from '@/features/workspace/schema';
import { audit, newId, type MockState } from '../store';
import { PERSONAS } from '../personas';
import { can, canAssign, isLinkedMember, linkedFirmId } from '../rules';
import { canUseChat } from './chat';
import {
  addLinkMembers,
  drop,
  find,
  hasLinkRow,
  inDays,
  need,
  now,
  raise,
  run,
  today,
  type Result,
} from './shared';
// Mirrors features/workspace/actions.ts#mutateAction case by case, with each Postgres function it calls
// (newest definition in supabase/migrations/) replayed against the in-memory store.
// Copied verbatim from features/workspace/actions.ts.
const permissions: Record<string, string> = {
  'building.create': 'building.create',
  'building.update': 'building.update',
  'building.archive': 'building.delete',
  'knowledge.save': 'agent.manage',
  'knowledge.delete': 'agent.manage',
  'agent.save': 'agent.manage',
  'agent.deploy': 'agent.deploy',
  'agent.pause': 'agent.deploy',
  'agent.delete': 'agent.manage',
  'document.update': 'vault.upload',
  'document.delete': 'vault.delete',
  'document.confirm': 'vault.upload',
  'bylaw.save': 'bylaw.edit',
  'bylaw.transition': 'bylaw.adopt',
  'bylaw.register': 'bylaw.adopt',
  'notice.save': 'document.draft',
  'notice.transition': 'chat.use',
  'notice.firm_review': 'document.draft',
  'notice.firm_decision': 'review.act',
  'notice.comment': 'chat.use',
  'dispute.save': 'dispute.create',
  'dispute.event': 'dispute.update',
  'update.state': 'chat.use',
  'member.change': 'member.update_role',
  'member.invite': 'member.invite',
  'org.update': 'building.update',
  'invite.revoke': 'member.invite',
  'chat.rename': 'chat.use',
  'chat.archive': 'chat.use',
};
type Table =
  | 'knowledge'
  | 'agents'
  | 'documents'
  | 'versions'
  | 'notices'
  | 'disputes'
  | 'updates'
  | 'members'
  | 'invitations'
  | 'chats'
  | 'bylaws';
const scopedTables: Record<string, Table> = {
  knowledge: 'knowledge',
  agent: 'agents',
  document: 'documents',
  bylaw: 'versions',
  notice: 'notices',
  dispute: 'disputes',
  update: 'updates',
  member: 'members',
  invite: 'invitations',
  chat: 'chats',
};
const enforcement = ['s135_notice', 'decision_letter', 'fine_notice'];
const regulatedTerms =
  /\b(fines?|rent|rents|rental|rentals|rented|renter|renters|renting|pets?|animals?|ages?|aged|discriminat[a-z]*)\b/i;
const disputeStages = [
  'reported',
  'investigating',
  'warning_sent',
  'notice_sent',
  'hearing_offered',
  'hearing_held',
  'decision_issued',
  'fine_levied',
  'resolved',
  'escalated_crt',
  'withdrawn',
];
const emailOf = (userId: unknown) => PERSONAS.find((p) => p.userId === userId)?.email;
const bumpCorpus = (s: MockState, b: string) => {
  const building = s.buildings.find((x) => x.id === b);
  if (building) building.corpus_version += 1;
};
// Demo only: residents get a bylaw-change alert when a version comes into force (mock/residents.ts shows them).
// Only the bylaw's name and section — never the version text, which may not be in the owner documents yet.
const inForceAlert = (s: MockState, b: string, nodeId: unknown) => {
  const node = s.bylaws.find((n) => n.id === nodeId && n.building_id === b);
  if (node)
    s.alerts.push({
      id: newId(),
      buildingId: b,
      title: `${String(node.title)} (${String(node.section_ref)}) is now in force`,
      body: 'Council brought an updated bylaw into force. Ask your building manager for the owner copy if it isn’t in your documents yet.',
      created_at: now(),
    });
};
// Mirrors `public.managing_org_ids`.
const managingOrgs = (s: MockState, b: unknown) =>
  [s.buildings.find((x) => x.id === b)?.org_id, linkedFirmId(s, String(b))].filter(Boolean);
export function mutate(s: MockState, userId: string, raw: unknown): Result<{ id?: string; url?: string }> {
  return run(() => {
    const input = mutationSchema.parse(raw);
    need(s, userId, permissions[input.operation], input.buildingId);
    const b = input.buildingId;
    const v = input.values;
    const requiredId = () => z.uuid().parse(input.id);
    // Validate record identity against the selected building, as `scopedRecord` does (chats are also owner-only under RLS).
    function scoped(table: Table, id: string): Row {
      const r = s[table].find(
        (x) => x.id === id && x.building_id === b && (table !== 'chats' || x.user_id === userId),
      );
      if (!r) throw new AppError('not_found', 'This record is unavailable in the selected building.', 404);
      return r;
    }
    const scopedTable = scopedTables[input.operation.split('.')[0]];
    const target = input.id && scopedTable ? scoped(scopedTable, input.id) : undefined;
    const record = () => target ?? scoped(scopedTable, requiredId());
    if (input.operation === 'bylaw.save' && v.nodeId) scoped('bylaws', z.uuid().parse(v.nodeId));
    if ((input.operation === 'dispute.event' || input.operation === 'notice.save') && v.disputeId)
      scoped('disputes', z.uuid().parse(v.disputeId));
    if (input.operation === 'agent.save' && v.knowledgeBaseId)
      scoped('knowledge', z.uuid().parse(v.knowledgeBaseId));
    const log = (table: string, op: string, id: unknown, buildingId: string | null = b) =>
      audit(s, userId, buildingId, table + '.' + op, id == null ? null : String(id));
    switch (input.operation) {
      case 'building.create': {
        const x = values.building.parse(v);
        // `create_building`: only a manager-level member of a firm org, on a portfolio account, may create one.
        const firm = s.organizations.find((o) => o.id === x.orgId && o.kind === 'firm');
        const profile = s.profiles.find((p) => p.id === userId);
        if (
          !firm ||
          profile?.account_type === 'single_building' ||
          !s.orgMembers.some(
            (m) =>
              m.org_id === x.orgId &&
              m.user_id === userId &&
              m.status === 'active' &&
              ['org_owner', 'org_admin', 'portfolio_manager'].includes(String(m.role)),
          )
        )
          raise('forbidden');
        if (x.name.length < 2) raise('invalid_input');
        // `private.create_firm_building`: its own building org, the building, and an active link to the firm.
        const org = {
          id: newId(),
          name: x.name.slice(0, 120),
          kind: 'building',
          plan: 'pilot',
          letterhead: firm.letterhead,
          signature_block: firm.signature_block,
          separation_of_duties: firm.separation_of_duties,
          created_at: now(),
        };
        const id = newId();
        s.organizations.push(org);
        s.buildings.push({
          id,
          org_id: org.id,
          name: x.name.slice(0, 120),
          strata_plan_no: x.plan || null,
          address: x.address,
          unit_count: x.units,
          municipality: '',
          corpus_version: 1,
          jurisdiction_chain: [],
        });
        const link = {
          id: newId(),
          building_id: id,
          firm_org_id: firm.id,
          status: 'active',
          invited_by: userId,
          accepted_by: userId,
          revoked_by: null,
          created_at: now(),
          accepted_at: now(),
          revoked_at: null,
        };
        s.firmLinks.push(link);
        addLinkMembers(s, link);
        log('buildings', 'insert', id, id);
        return { id };
      }
      case 'building.update': {
        const x = values.building.parse(v);
        const building = s.buildings.find((y) => y.id === b);
        if (building) Object.assign(building, { name: x.name, address: x.address, unit_count: x.units });
        log('buildings', 'update', b);
        return {};
      }
      case 'building.archive':
        // A linked firm cannot archive a building it does not own.
        if (hasLinkRow(s, userId, b)) raise('forbidden');
        s.buildings = s.buildings.filter((y) => y.id !== b);
        log('buildings', 'update', b);
        return {};
      case 'knowledge.save': {
        const x = values.knowledge.parse(v);
        if (target) {
          Object.assign(target, x);
          log('knowledge_bases', 'update', target.id);
          return {};
        }
        const id = newId();
        s.knowledge.push({ id, building_id: b, ...x, created_at: now() });
        log('knowledge_bases', 'insert', id);
        return { id };
      }
      case 'knowledge.delete': {
        const r = record();
        drop(s.knowledge, r.id);
        log('knowledge_bases', 'update', r.id);
        return {};
      }
      case 'agent.save': {
        const x = values.agent.parse(v);
        const data = {
          name: x.name,
          description: x.description,
          instructions: x.instructions,
          knowledge_base_id: x.knowledgeBaseId || null,
          include_legal: x.includeLegal,
          top_k: x.topK,
        };
        if (target) {
          Object.assign(target, data);
          log('agents', 'update', target.id);
          return {};
        }
        const id = newId();
        s.agents.push({
          id,
          building_id: b,
          ...data,
          status: 'draft',
          created_by: userId,
          created_at: now(),
        });
        log('agents', 'insert', id);
        return { id };
      }
      case 'agent.deploy': {
        const a = record();
        // `deploy_agent`: at least one ready document in the agent's knowledge base (or the building, with none).
        if (
          !s.documents.some(
            (d) =>
              d.building_id === b &&
              d.status === 'ready' &&
              (a.knowledge_base_id == null || d.knowledge_base_id === a.knowledge_base_id),
          )
        )
          raise('knowledge_not_ready');
        const version =
          Math.max(0, ...s.deployments.filter((d) => d.agent_id === a.id).map((d) => Number(d.version))) + 1;
        const id = newId();
        s.deployments.push({
          id,
          building_id: b,
          agent_id: a.id,
          version,
          config: {
            name: a.name,
            instructions: a.instructions,
            knowledge_base_id: a.knowledge_base_id,
            include_legal: a.include_legal,
            top_k: a.top_k,
          },
          deployed_by: userId,
          created_at: now(),
        });
        a.status = 'deployed';
        log('agent_deployments', 'insert', id);
        return { id };
      }
      case 'agent.pause': {
        const a = record();
        a.status = 'paused';
        log('agents', 'update', a.id);
        return {};
      }
      case 'agent.delete': {
        const a = record();
        drop(s.agents, a.id);
        log('agents', 'update', a.id);
        return {};
      }
      case 'document.update': {
        const x = values.document.parse(v);
        const d = record();
        Object.assign(d, {
          title: x.title,
          type: x.type,
          effective_date: x.effectiveDate || null,
          lto_filing_ref: x.filingReference || null,
        });
        log('documents', 'update', d.id);
        return {};
      }
      case 'document.delete': {
        const d = record();
        drop(s.documents, d.id);
        s.chunks = s.chunks.filter((c) => c.documentId !== d.id);
        bumpCorpus(s, b);
        log('documents', 'update', d.id);
        return {};
      }
      case 'document.confirm': {
        const d = record();
        if (d.status !== 'review') raise('invalid_transition');
        // `confirm_document_structure`: a bylaws document becomes a new set of draft nodes, one per parsed section.
        if (d.type === 'bylaws' && Array.isArray(d.parsed_sections)) {
          const set = newId();
          for (const item of d.parsed_sections as {
            sectionRef?: string;
            heading?: string;
            content?: string;
          }[]) {
            const node = newId();
            s.bylaws.push({
              id: node,
              building_id: b,
              title: item.heading ?? '',
              section_ref: item.sectionRef ?? '',
              set_id: set,
              created_at: now(),
            });
            s.versions.push({
              id: newId(),
              building_id: b,
              node_id: node,
              version: 1,
              body: item.content ?? '',
              rationale: '',
              status: 'draft',
              effective_date: null,
              filing_reference: null,
              created_by: userId,
              review_choice: null,
              source_document_id: d.id,
              created_at: now(),
            });
          }
        }
        Object.assign(d, { structure_confirmed: true, status: 'ready' });
        bumpCorpus(s, b);
        log('documents', 'update', d.id);
        return {};
      }
      case 'bylaw.save': {
        const x = values.bylaw.parse(v);
        let node = x.nodeId;
        if (!node) {
          const set = s.bylaws.find((n) => n.building_id === b)?.set_id ?? newId();
          node = newId();
          s.bylaws.push({
            id: node,
            building_id: b,
            title: x.title,
            section_ref: x.section,
            set_id: set,
            created_at: now(),
          });
        }
        const version =
          Math.max(0, ...s.versions.filter((r) => r.node_id === node).map((r) => Number(r.version))) + 1;
        const id = newId();
        s.versions.push({
          id,
          building_id: b,
          node_id: node,
          version,
          body: x.body,
          rationale: x.rationale,
          status: 'draft',
          effective_date: null,
          filing_reference: null,
          created_by: userId,
          review_choice: null,
          source_document_id: null,
          created_at: now(),
        });
        log('bylaw_versions', 'insert', id);
        return { id };
      }
      case 'bylaw.transition': {
        const x = values.transition.parse(v);
        const r = record();
        const status = String(r.status);
        // `transition_bylaw`, step by step.
        if (x.status === 'in_review' && status === 'draft')
          Object.assign(r, { status: x.status, review_choice: 'counsel' });
        else if (x.status === 'proposed' && ['draft', 'in_review'].includes(status)) {
          if (!x.review) raise('review_required');
          // No hardcoded legal-cap assertion. A lawyer must review potentially regulated terms.
          if (regulatedTerms.test(String(r.body)) && (x.override?.length ?? 0) < 20 && x.review !== 'counsel')
            raise('legal_review_required');
          Object.assign(r, { status: x.status, review_choice: x.review, override_reason: x.override });
        } else if (
          x.status === 'voted' &&
          status === 'proposed' &&
          x.for != null &&
          x.against != null &&
          x.abstain != null &&
          x.for + x.against > 0
        )
          Object.assign(r, {
            status: x.status,
            vote_for: x.for,
            vote_against: x.against,
            vote_abstain: x.abstain,
          });
        else if (
          x.status === 'adopted' &&
          status === 'voted' &&
          4 * Number(r.vote_for) >= 3 * (Number(r.vote_for) + Number(r.vote_against))
        ) {
          r.status = 'adopted';
          s.updates.push({
            id: newId(),
            building_id: b,
            type: 'unfiled_adoption',
            title: 'Filing record needed',
            body: 'Record and verify the LTO filing before this amendment is treated as in force.',
            severity: 'warning',
            target_id: r.id,
            state: 'new',
            snoozed_until: null,
            created_at: now(),
          });
        } else if (x.status === 'filed' && status === 'adopted' && (x.filing?.length ?? 0) > 2 && x.effective)
          Object.assign(r, { status: 'filed', filing_reference: x.filing, effective_date: x.effective });
        else if (x.status === 'in_force' && status === 'filed' && String(r.effective_date) <= today()) {
          for (const o of s.versions)
            if (o.node_id === r.node_id && o.status === 'in_force')
              Object.assign(o, { status: 'superseded', effective_until: r.effective_date });
          r.status = 'in_force';
          for (const u of s.updates)
            if (u.target_id === r.id && u.type === 'unfiled_adoption') u.state = 'actioned';
          bumpCorpus(s, b);
          inForceAlert(s, b, r.node_id);
        } else if (
          ['withdrawn', 'defeated'].includes(x.status) &&
          !['filed', 'in_force', 'superseded'].includes(status)
        )
          r.status = x.status;
        else raise('invalid_transition');
        log('bylaw_versions', 'update', r.id);
        return {};
      }
      case 'bylaw.register': {
        const x = values.register.parse(v);
        const r = record();
        // `record_registered_bylaw`: only an imported draft, with a filing record and a date not in the future.
        if (
          r.status !== 'draft' ||
          r.source_document_id == null ||
          x.filing.trim().length < 3 ||
          x.effective > today()
        )
          raise('invalid_transition');
        for (const o of s.versions)
          if (o.node_id === r.node_id && o.status === 'in_force')
            Object.assign(o, { status: 'superseded', effective_until: x.effective });
        Object.assign(r, {
          status: 'in_force',
          review_choice: 'registered',
          filing_reference: x.filing.trim(),
          effective_date: x.effective,
        });
        bumpCorpus(s, b);
        inForceAlert(s, b, r.node_id);
        log('bylaw_versions', 'update', r.id);
        return {};
      }
      case 'notice.save': {
        const x = values.notice.parse(v);
        if (target) {
          // `save_artifact`: an approved or sent document is immutable; editing a firm-pending draft withdraws it.
          if (!['draft', 'pending_review', 'changes_requested'].includes(String(target.status)))
            raise('immutable_approved_document');
          if (target.status === 'pending_review' && target.review_by === 'firm')
            s.comments.push({
              id: newId(),
              building_id: b,
              document_id: target.id,
              author_id: userId,
              body: 'This draft was edited, which withdrew it from strata management review.',
              created_at: now(),
            });
          Object.assign(target, { title: x.title, body_md: x.body, status: 'draft', review_by: 'building' });
          log('generated_documents', 'update', target.id);
          return {};
        }
        const id = newId();
        s.notices.push({
          id,
          building_id: b,
          dispute_id: x.disputeId || null,
          kind: x.kind,
          title: x.title,
          body_md: x.body,
          status: 'draft',
          review_by: 'building',
          created_by: userId,
          approved_by: null,
          approved_at: null,
          sent_at: null,
          created_at: now(),
        });
        log('generated_documents', 'insert', id);
        return { id };
      }
      case 'notice.transition': {
        const x = z
          .object({
            status: z.enum(['pending_review', 'approved', 'sent', 'void']),
            occurredAt: z.iso.datetime().nullable().default(null),
            confirmed: z.literal(true),
          })
          .parse(v);
        const d = record();
        if (d.status === x.status) return {};
        // While the firm is reviewing, only its decision may move the document forward.
        if (d.status === 'pending_review' && d.review_by === 'firm' && x.status !== 'void')
          raise('firm_review_pending');
        if (x.status === 'pending_review' && d.status === 'draft' && can(s, userId, 'document.draft', b))
          Object.assign(d, { status: x.status, review_by: 'building' });
        else if (
          x.status === 'approved' &&
          d.status === 'pending_review' &&
          can(s, userId, 'document.approve', b)
        ) {
          const org = s.organizations.find((o) => o.id === s.buildings.find((y) => y.id === b)?.org_id);
          if (
            org?.separation_of_duties !== false &&
            enforcement.includes(String(d.kind)) &&
            d.created_by === userId
          )
            raise('self_approval_not_permitted');
          Object.assign(d, { status: 'approved', approved_by: userId, approved_at: now() });
        } else if (x.status === 'sent' && d.status === 'approved' && can(s, userId, 'document.send', b)) {
          if (!x.occurredAt || x.occurredAt > now()) raise('invalid_occurred_at');
          Object.assign(d, { status: 'sent', sent_at: x.occurredAt });
          if (d.dispute_id != null && !s.events.some((e) => e.idempotency_key === d.id))
            s.events.push({
              id: newId(),
              building_id: b,
              dispute_id: d.dispute_id,
              stage: 'notice_sent',
              occurred_at: x.occurredAt,
              logged_at: now(),
              summary: 'Approved correspondence marked as sent',
              actor_id: userId,
              idempotency_key: d.id,
            });
        } else if (x.status === 'void' && d.status !== 'sent' && can(s, userId, 'document.approve', b))
          drop(s.notices, d.id);
        else raise('invalid_transition');
        log('generated_documents', 'update', d.id);
        return {};
      }
      case 'notice.firm_review': {
        z.object({ confirmed: z.literal(true) }).parse(v);
        const d = record();
        // `request_firm_review`: the building's own staff send it; the firm's staff never review their own request.
        if (isLinkedMember(s, userId, b)) raise('forbidden');
        if (!['draft', 'changes_requested'].includes(String(d.status))) raise('invalid_transition');
        if (!linkedFirmId(s, b)) raise('no_firm_link');
        Object.assign(d, { status: 'pending_review', review_by: 'firm' });
        log('generated_documents', 'update', d.id);
        return {};
      }
      case 'notice.firm_decision': {
        const x = z
          .object({
            decision: z.enum(['approved', 'changes_requested']),
            comment: z.string().trim().max(4000).default(''),
            confirmed: z.literal(true),
          })
          .parse(v);
        const d = record();
        // `decide_firm_review`: only the linked firm decides, and changes need a reason.
        if (!isLinkedMember(s, userId, b)) raise('forbidden');
        if (d.status !== 'pending_review' || d.review_by !== 'firm') raise('invalid_transition');
        if (x.decision === 'changes_requested' && !x.comment) raise('comment_required');
        if (x.decision === 'approved') {
          if (enforcement.includes(String(d.kind)) && d.created_by === userId)
            raise('self_approval_not_permitted');
          Object.assign(d, { status: 'approved', approved_by: userId, approved_at: now() });
        } else d.status = 'changes_requested';
        if (x.comment)
          s.comments.push({
            id: newId(),
            building_id: b,
            document_id: d.id,
            author_id: userId,
            body: x.comment,
            created_at: now(),
          });
        log('generated_documents', 'update', d.id);
        return {};
      }
      case 'notice.comment': {
        const x = z.object({ body: z.string().trim().min(1).max(4000) }).parse(v);
        const d = record();
        const id = newId();
        s.comments.push({
          id,
          building_id: b,
          document_id: d.id,
          author_id: userId,
          body: x.body,
          created_at: now(),
        });
        log('document_review_comments', 'insert', id);
        return { id };
      }
      case 'dispute.save': {
        const x = values.dispute.parse(v);
        if (target) {
          Object.assign(target, { title: x.title, category: x.category, subject_unit: x.unit });
          log('disputes', 'update', target.id);
          return {};
        }
        const id = newId();
        s.disputes.push({
          id,
          building_id: b,
          title: x.title,
          category: x.category,
          subject_unit: x.unit,
          reference: 'D-' + new Date().getFullYear() + '-' + randomBytes(3).toString('hex').toUpperCase(),
          stage: 'reported',
          opened_by: userId,
          created_at: now(),
        });
        log('disputes', 'insert', id);
        return { id };
      }
      case 'dispute.event': {
        const x = values.event.parse(v);
        // `log_dispute_event`: a known stage, not in the future, and at most once per idempotency key.
        if (!disputeStages.includes(x.stage) || x.occurredAt > now()) raise('invalid_input');
        if (s.events.some((e) => e.idempotency_key === x.key)) return {};
        const id = newId();
        s.events.push({
          id,
          building_id: b,
          dispute_id: x.disputeId,
          stage: x.stage,
          occurred_at: x.occurredAt,
          logged_at: now(),
          summary: x.summary,
          actor_id: userId,
          idempotency_key: x.key,
        });
        const dispute = find(s.disputes, x.disputeId);
        if (dispute) dispute.stage = x.stage;
        log('dispute_events', 'insert', id);
        return { id };
      }
      case 'update.state': {
        const x = values.notification.parse(v);
        const u = record();
        // `update_notification`: anyone who can read the building may mark it viewed; anything else needs `bylaw.adopt`.
        need(s, userId, x.state === 'viewed' ? 'building.read' : 'bylaw.adopt', b);
        if (x.state === 'dismissed' && (x.reason?.length ?? 0) < 3) raise('reason_required');
        if (x.state === 'snoozed' && (!x.until || x.until <= today())) raise('date_required');
        Object.assign(u, { state: x.state, dismissal_reason: x.reason, snoozed_until: x.until });
        log('notifications', 'update', u.id);
        return {};
      }
      case 'member.change': {
        const x = values.member.parse(v);
        const m = record();
        // `change_membership` (newest definition, 20260927092000_firm_link_codes.sql).
        if (m.via_link_id != null) raise('linked_member');
        if (
          m.user_id === userId ||
          !canAssign(s, userId, b, String(m.role)) ||
          !canAssign(s, userId, b, x.role)
        )
          raise('forbidden');
        // Linked firm staff cannot remove or demote the people who can revoke the firm…
        if (['building_manager', 'council_president'].includes(String(m.role)) && hasLinkRow(s, userId, b))
          raise('forbidden');
        // …and can only assign roles that stay under the building's control.
        if (!['council_member', 'external_counsel'].includes(x.role) && hasLinkRow(s, userId, b, true))
          raise('forbidden');
        Object.assign(m, { role: x.role, status: x.remove ? 'suspended' : 'active' });
        log('building_members', 'update', m.id);
        return {};
      }
      case 'member.invite': {
        const x = values.invite.parse(v);
        // `create_invitation` (newest definition, 20260927091000_building_orgs.sql). The demo only knows the
        // personas' emails, so the email-based checks can only match those four people.
        if (!canAssign(s, userId, b, x.role)) raise('forbidden');
        if (!['council_member', 'external_counsel'].includes(x.role) && hasLinkRow(s, userId, b, true))
          raise('forbidden');
        const theirs = s.members.filter((m) => m.building_id === b && emailOf(m.user_id) === x.email);
        if (
          theirs.some(
            (m) =>
              m.status === 'active' && (m.expires_at == null || new Date(String(m.expires_at)) > new Date()),
          )
        )
          raise('already_member');
        if (theirs.some((m) => m.via_link_id == null && !canAssign(s, userId, b, String(m.role))))
          raise('forbidden');
        const profile = s.profiles.find((p) => emailOf(p.id) === x.email);
        if (
          profile?.account_type === 'single_building' &&
          profile.bound_building_id !== b &&
          managingOrgs(s, profile.bound_building_id).some((o) => managingOrgs(s, b).includes(o))
        )
          raise('single_building_conflict');
        if (
          x.role === 'external_counsel' &&
          (!x.expiresAt || x.expiresAt <= now() || x.expiresAt > inDays(90))
        )
          raise('expiry_required');
        const token = randomBytes(32).toString('hex');
        const id = newId();
        s.invitations.push({
          id,
          building_id: b,
          email: x.email,
          role: x.role,
          invited_by: userId,
          token_hash: createHash('sha256').update(token).digest('hex'),
          membership_expires_at: x.expiresAt,
          expires_at: inDays(7),
          accepted_at: null,
          revoked_at: null,
          created_at: now(),
        });
        log('invitations', 'insert', id);
        // Invitations are simulated in the demo: the link opens a page that explains so instead of an accept flow.
        return { id, url: '/demo/invite/' + token };
      }
      case 'invite.revoke': {
        const i = record();
        i.revoked_at = now();
        log('invitations', 'update', i.id);
        return {};
      }
      case 'org.update': {
        const x = z
          .object({
            name: z.string().min(2).max(120),
            letterhead: z.string().max(2000),
            signature_block: z.string().max(1000),
            orgId: z.uuid(),
          })
          .parse(v);
        // `org_update` RLS: only an org owner or admin. The real update silently matches no row otherwise; the demo
        // says so instead, so a persona never sees a save that did nothing.
        if (
          !s.orgMembers.some(
            (m) =>
              m.org_id === x.orgId &&
              m.user_id === userId &&
              m.status === 'active' &&
              ['org_owner', 'org_admin'].includes(String(m.role)),
          )
        )
          throw new ForbiddenError();
        const org = find(s.organizations, x.orgId);
        if (org)
          Object.assign(org, { name: x.name, letterhead: x.letterhead, signature_block: x.signature_block });
        log('organizations', 'update', x.orgId);
        return {};
      }
      case 'chat.rename': {
        const title = z.string().min(1).max(150).parse(v.title);
        const c = record();
        if (!canUseChat(s, userId, c.id)) raise('forbidden');
        Object.assign(c, { title, updated_at: now() });
        log('chats', 'update', c.id);
        return {};
      }
      case 'chat.archive': {
        const c = record();
        if (!canUseChat(s, userId, c.id)) raise('forbidden');
        c.archived = true;
        log('chats', 'update', c.id);
        return {};
      }
      default:
        throw new AppError('invalid_operation', 'Choose a valid action.');
    }
  });
}
