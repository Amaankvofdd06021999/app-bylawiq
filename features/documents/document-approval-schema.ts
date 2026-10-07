import { z } from 'zod';

// Document approval schemas

export const DocumentReviewSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  buildingId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'changes_requested']),
  comment: z.string().optional(),
  changesRequestedCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DocumentSubmissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  buildingId: z.string().uuid(),
  status: z.enum(['draft', 'submitted', 'approved', 'sent', 'archived']),
  submittedBy: z.string().uuid().optional(),
  submittedAt: z.string().datetime().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
  sentBy: z.string().uuid().optional(),
  sentAt: z.string().datetime().optional(),
});

export const PendingReviewSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  buildingId: z.string().uuid(),
  buildingName: z.string(),
  submittedBy: z.string().uuid(),
  submitterName: z.string(),
  status: z.enum(['pending', 'changes_requested']),
  changesRequestedCount: z.number().int(),
  lastComment: z.string().optional(),
  createdAt: z.string().datetime(),
  daysWaiting: z.number().int(),
});

export type DocumentReview = z.infer<typeof DocumentReviewSchema>;
export type DocumentSubmission = z.infer<typeof DocumentSubmissionSchema>;
export type PendingReview = z.infer<typeof PendingReviewSchema>;
