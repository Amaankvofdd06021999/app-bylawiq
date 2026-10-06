import 'server-only';
import { requireUser } from '@/lib/auth/guards';
import { buildingSchema, profileSchema, rowSchema, chatSchema } from '@/lib/schema';
import { checkDb, NotFoundError } from '@/lib/errors';
import { z } from 'zod';
import { RESOURCES, type Resource } from '@/lib/resources';
export async function workspace() {
  const user = await requireUser();
  const responses = await Promise.all([
    user.client
      .from('profiles')
      .select('id,display_name,account_type,bound_building_id')
      .eq('id', user.id)
      .single(),
    user.client
      .from('buildings')
      .select(
        'id,org_id,name,strata_plan_no,address,unit_count,municipality,corpus_version,jurisdiction_chain',
      )
      .order('name'),
    user.client.from('organizations').select('id,name,kind,plan,letterhead,signature_block'),
    user.client
      .from('building_members')
      .select('id,building_id,role,status,expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);
  responses.forEach((r) => checkDb(r.error));
  return {
    profile: profileSchema.parse(responses[0].data),
    buildings: z.array(buildingSchema).parse(responses[1].data),
    organizations: z.array(rowSchema).parse(responses[2].data),
    memberships: z.array(rowSchema).parse(responses[3].data),
    email: user.email,
  };
}
export type { Resource };
export async function listResource(resource: Resource, buildingId: string) {
  const user = await requireUser();
  const table: string = RESOURCES[resource][0];
  const columns: string = RESOURCES[resource][1];
  const { data, error } = await user.client
    .from(table)
    .select(columns)
    .eq('building_id', buildingId)
    .limit(250);
  checkDb(error);
  return z
    .array(
      resource === 'audit'
        ? rowSchema.extend({ id: z.union([z.string(), z.number()]).transform(String) })
        : rowSchema,
    )
    .parse(data);
}
export async function buildingWorkspace(buildingId: string) {
  const state = await workspace();
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) throw new NotFoundError();
  const user = await requireUser();
  const { data: membership, error } = await user.client.rpc('my_building_role', { p_building: buildingId });
  checkDb(error);
  const { data: permissions, error: e } = await user.client
    .from('role_permissions')
    .select('permission')
    .eq('role', membership);
  checkDb(e);
  const unread = await user.client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('building_id', buildingId)
    .eq('state', 'new');
  checkDb(unread.error);
  const own = await user.client
    .from('building_members')
    .select('via_link_id')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .maybeSingle();
  checkDb(own.error);
  return {
    ...state,
    building,
    unreadUpdates: unread.count ?? 0,
    linkedMember:
      z.object({ via_link_id: z.uuid().nullable() }).nullable().parse(own.data)?.via_link_id != null,
    permissions: z
      .array(z.object({ permission: z.string() }))
      .parse(permissions)
      .map((p) => p.permission),
  };
}
export async function conversation(chatId: string) {
  const user = await requireUser();
  const { data, error } = await user.client
    .from('chats')
    .select('id,building_id,user_id,title,scope,scope_building_ids,as_of,source_types,agent_deployment_id')
    .eq('id', chatId)
    .single();
  if (error || !data) throw new NotFoundError();
  const chat = chatSchema.parse(data);
  const { data: messages, error: me } = await user.client
    .from('messages')
    .select('id,role,parts')
    .eq('chat_id', chatId)
    .order('created_at');
  checkDb(me);
  return {
    chat,
    messages: z
      .array(z.object({ id: z.string(), role: z.enum(['user', 'assistant']), parts: z.array(z.unknown()) }))
      .parse(messages),
  };
}
