import { z } from 'zod';

export const InviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant']),
});

export const RemoveTeamMemberSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
});

export const ResendInvitationSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
});

export type InviteTeamMemberInput = z.infer<typeof InviteTeamMemberSchema>;
export type RemoveTeamMemberInput = z.infer<typeof RemoveTeamMemberSchema>;
export type ResendInvitationInput = z.infer<typeof ResendInvitationSchema>;
