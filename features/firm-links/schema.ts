import { z } from 'zod';
import { id } from '@/lib/schema';
export const buildingInput = z.object({ buildingId: id });
export const acceptInput = z.object({ code: z.string().trim().min(8).max(20), firmOrgId: id });
export const firmLinkStatusSchema = z
  .object({
    status: z.enum(['none', 'invited', 'active']),
    firm_name: z.string().nullable(),
    since: z.string().nullable(),
    code_expires_at: z.string().nullable(),
  })
  .transform((r) => ({
    status: r.status,
    firmName: r.firm_name,
    since: r.since,
    codeExpiresAt: r.code_expires_at,
  }));
export type FirmLinkStatus = z.output<typeof firmLinkStatusSchema>;
