import { z } from 'zod';
export const id = z.uuid();
export const role = z.enum([
  'org_owner',
  'org_admin',
  'portfolio_manager',
  'portfolio_assistant',
  'building_manager',
  'council_president',
  'council_member',
  'external_counsel',
  'owner_resident',
]);
export const buildingSchema = z.object({
  id,
  org_id: id,
  name: z.string(),
  strata_plan_no: z.string().nullable(),
  address: z.string(),
  unit_count: z.number().nullable(),
  municipality: z.string(),
  corpus_version: z.number(),
  jurisdiction_chain: z.array(id),
});
export const profileSchema = z.object({
  id,
  display_name: z.string(),
  consent_at: z.string().nullable(),
  bound_building_id: id.nullable(),
});
export const rowSchema = z
  .object({
    id,
    building_id: id.optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();
export const chatSchema = z.object({
  id,
  building_id: id.nullable(),
  user_id: id,
  title: z.string(),
  scope: z.enum(['building', 'general', 'portfolio']),
  scope_building_ids: z.array(id),
  as_of: z.string().nullable(),
  source_types: z.array(z.string()),
  agent_deployment_id: id.nullable(),
});
export type Building = z.infer<typeof buildingSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Row = z.infer<typeof rowSchema>;

export const APP_ROLES = [
  'platform_admin',
  'org_owner',
  'org_admin',
  'portfolio_manager',
  'portfolio_assistant',
  'building_manager',
  'council_president',
  'council_member',
  'external_counsel',
  'owner_resident',
] as const;
export type AppRole = (typeof APP_ROLES)[number];
