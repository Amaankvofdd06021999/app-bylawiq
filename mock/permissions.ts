import {z} from 'zod';
import {role} from '@/lib/schema';
export type AppRole=z.infer<typeof role>;
// Copied literally from the `insert into public.role_permissions` statements in
// supabase/migrations/20260914092313_identity.sql and supabase/migrations/20260927090000_firm_links_schema.sql.
// Keep this in sync with those migrations by hand — there is no database to read it from in the demo.
const managerPermissions=['building.read','vault.read','vault.upload','vault.delete','chat.use','bylaw.edit','bylaw.adopt','document.draft','document.approve','document.send','dispute.read','dispute.create','dispute.update','member.read','member.invite','member.update_role','member.remove','audit.read','agent.manage','agent.deploy'] as const;
const assistantPermissions=['building.read','vault.read','vault.upload','chat.use','bylaw.edit','document.draft','dispute.read','dispute.create','dispute.update','member.read'] as const;
const readOnlyStaffPermissions=['building.read','vault.read','chat.use','dispute.read','member.read'] as const;
const residentPermissions=['building.read','vault.read'] as const;
const orgAdminPermissions=['org.manage','building.create','building.update','building.delete','chat.use_portfolio'] as const;
// `lib/schema.ts`'s `role` (and so `AppRole`) excludes `platform_admin`: no membership table can hold it
// (`building_members` and `org_members` both forbid it), so it never gets a `role_permissions` row either.
export const ROLE_PERMISSIONS:Record<AppRole,readonly string[]>={
 org_owner:[...managerPermissions,...orgAdminPermissions,'billing.manage','review.act'],
 org_admin:[...managerPermissions,...orgAdminPermissions,'review.act'],
 portfolio_manager:[...managerPermissions,'building.create','chat.use_portfolio','review.act'],
 portfolio_assistant:assistantPermissions,
 building_manager:[...managerPermissions,'building.link_firm'],
 council_president:[...managerPermissions,'building.link_firm'],
 council_member:readOnlyStaffPermissions,
 external_counsel:readOnlyStaffPermissions,
 owner_resident:residentPermissions,
};
export function permissionsFor(r:AppRole|null):string[]{return r?[...ROLE_PERMISSIONS[r]]:[];}
