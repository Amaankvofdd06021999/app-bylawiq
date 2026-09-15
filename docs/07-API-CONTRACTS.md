# 07 — API Contracts

## 1. When to use what

| Mechanism | Use for | Not for |
|---|---|---|
| **Server Component** | Reading data for initial render | Mutations |
| **Server Action** | All mutations from the UI (CRUD, uploads, approvals) | Streaming |
| **Route Handler** | Streaming (`/api/chat`), webhooks, file uploads, third-party callbacks | Ordinary CRUD |

Default to Server Actions. Route handlers exist where you need a Response object you control.

## 2. Every action starts the same way

```ts
'use server';

export async function createDisputeAction(raw: unknown) {
  const user  = await requireUser();
  const input = CreateDisputeSchema.parse(raw);
  await requirePermission(user, 'dispute.create', input.buildingId);

  const supabase = await createServerClient();          // RLS-scoped
  const { data, error } = await supabase
    .from('disputes')
    .insert({ ...input, opened_by: user.id })
    .select('id, reference, stage')                     // never select *
    .single();

  if (error) throw mapPgError(error);

  await logAudit('dispute.create', 'dispute', data.id, input.buildingId);
  revalidatePath(`/b/${input.buildingId}/disputes`);
  return data;
}
```

Auth → validate → authorize → act → audit → revalidate. If a reviewer cannot point at all six lines, the action is incomplete.

## 3. Shared schemas

`features/*/schema.ts` — one Zod schema per boundary, inferred types exported. Never hand-write a type that a schema can infer.

```ts
export const BuildingIdSchema = z.string().uuid();

export const CreateBuildingSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(2).max(120),
  strataPlanNo: z.string().regex(/^[A-Z]{1,4}\s?\d{1,6}$/).optional(),  // 'EPS 4482'
  unitCount: z.number().int().positive().max(5000).optional(),
  fiscalYearEnd: z.string().date().optional(),
});

export const ChatRequestSchema = z.object({
  chatId: z.string().uuid(),
  message: z.object({
    id: z.string(),
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string().max(20_000) }),
      z.object({ type: z.literal('file'), mediaType: z.string(), url: z.string() }),
    ])),
  }),
  // scope hints — validated server-side, never trusted
  scope: z.object({
    docTypes: z.array(DocTypeSchema).optional(),
    asOfDate: z.string().date().optional(),
    portfolio: z.boolean().default(false),
  }).optional(),
});
```

`scope.portfolio` arrives from the client but is only honoured after `requirePermission(user, 'chat.use_portfolio', …)`. Client-supplied scope is a *request*, never an *instruction*.

## 4. Endpoint inventory

### Route handlers

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat. Doc 04 §8. |
| `/api/upload` | POST | Multipart → Supabase Storage → enqueue ingestion |
| `/api/documents/[id]/download` | GET | Permission check → 300 s signed URL → 302 |
| `/api/inngest` | POST | Inngest handler |
| `/api/webhooks/stripe` | POST | Billing. Signature verified. |
| `/api/health` | GET | DB, storage, model provider reachability |

### Server actions by feature

**buildings** — `createBuildingAction`, `updateBuildingAction`, `archiveBuildingAction`
**members** — `inviteMemberAction`, `changeRoleAction`, `removeMemberAction`, `acceptInviteAction`
**vault** — `registerUploadAction`, `deleteDocumentAction`, `supersedeDocumentAction`, `retryIngestionAction`
**chat** — `createChatAction`, `renameChatAction`, `archiveChatAction`, `branchFromMessageAction`, `reportMessageAction`
**disputes** — `createDisputeAction`, `updateDisputeStageAction`, `logDisputeEventAction`
**documents** — `saveDraftAction`, `approveDocumentAction`, `markSentAction`, `voidDocumentAction`

Note what is missing: no `deleteDisputeEventAction`, no `editAuditLogAction`. The legal record is append-only.

## 5. Two contracts worth spelling out

### `changeRoleAction` — privilege escalation surface

```ts
export async function changeRoleAction(raw: unknown) {
  const user  = await requireUser();
  const input = ChangeRoleSchema.parse(raw);           // { membershipId, role }
  const supabase = await createServerClient();

  const { data: m } = await supabase
    .from('building_members')
    .select('id, building_id, user_id, role')
    .eq('id', input.membershipId)
    .single();
  if (!m) throw new NotFoundError();

  await requirePermission(user, 'member.update_role', m.building_id);

  if (m.user_id === user.id)          throw new ForbiddenError('cannot change your own role');
  if (input.role === 'platform_admin') throw new ForbiddenError('not assignable');
  if (!assignableBy(user.buildings[m.building_id]).includes(input.role))
    throw new ForbiddenError('cannot grant a role above your own');

  await supabase.rpc('change_building_role', { p_membership_id: m.id, p_role: input.role });
  await invalidateUserSessions(m.user_id);   // JWT claims are stale until refresh — doc 03 §3
  await logAudit('member.role_change', 'building_member', m.id, m.building_id,
                 { from: m.role, to: input.role });
}
```

Four guards: not yourself, not platform admin, not above your own level, and force a session refresh so a demotion takes effect immediately rather than at token expiry.

### `approveDocumentAction` — the verification gate

Thin wrapper over the `approve_generated_document` RPC (doc 03 §5). The checks live in the database because that is the boundary that cannot be bypassed. The action's only extra job is telemetry and revalidation.

## 6. Error mapping

```ts
export function mapPgError(e: PostgrestError): AppError {
  if (e.code === '42501') return new ForbiddenError();          // RLS denial
  if (e.code === '23505') return new ConflictError('already exists');
  if (e.code === '23503') return new BadRequestError('referenced record missing');
  if (e.message.includes('forbidden')) return new ForbiddenError();
  if (e.message.includes('self_approval_not_permitted'))
    return new ForbiddenError('Someone else needs to approve this notice.');
  logger.error('unmapped pg error', { code: e.code });
  return new InternalError();
}
```

An RLS denial surfaces as 403 with no detail. Do not tell a caller whether the row exists — for building lookups, return 404 rather than 403 so building IDs cannot be enumerated.

## 7. Rate limits

| Scope | Limit | Window |
|---|---|---|
| Chat messages / user | 30 | 1 min |
| Chat messages / org | 300 | 1 min |
| Uploads / building | 50 | 1 hour |
| Document generation / user | 20 | 1 hour |
| Auth attempts / IP | 10 | 15 min |

Sliding window in Upstash Redis, checked before `streamText` — after the model call has started, the cost is already incurred. A 429 returns `retryAfter` and renders as an inline message with a countdown, not a toast.

## 8. Idempotency

Anything that costs money or creates a legal record takes an `Idempotency-Key`: document generation, notice sending, billing. Store keys for 24 h with the response; a repeat returns the stored result rather than generating a second notice. A manager double-clicking "Send notice" must not put two notices in the dispute timeline.

## 9. Realtime

Supabase Realtime, used narrowly:

- `documents` status changes → live ingestion progress in the vault.
- `dispute_events` inserts → timeline updates when a colleague acts.

Not used for chat streaming — the AI SDK stream handles that. Subscriptions are scoped by building and filtered by RLS.
