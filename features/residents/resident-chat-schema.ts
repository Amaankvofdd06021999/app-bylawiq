import { z } from 'zod';

export const SendResidentMessageSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  chatId: z.string().uuid('Invalid chat ID').optional(),
});

export const SpendCreditSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  action: z.enum(['question', 'draft_notice', 'email_reply']),
  chatRunId: z.string().uuid('Invalid run ID').optional(),
});

export type SendResidentMessageInput = z.infer<typeof SendResidentMessageSchema>;
export type SpendCreditInput = z.infer<typeof SpendCreditSchema>;

export interface ResidentChatState {
  building_id: string;
  user_id: string;
  free_questions_used: number;
  credits: number;
  total_credits: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  sources?: Array<{
    document_id: string;
    document_title: string;
    chunk_id: string;
    relevance: number;
  }>;
  created_at: string;
}
