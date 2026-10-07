import { z } from 'zod';

export const CreateBulletinPostSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  title: z.string().min(1, 'Title required').max(120, 'Title too long'),
  body: z.string().min(1, 'Body required').max(5000, 'Body too long'),
});

export const UpdateBulletinPostSchema = z.object({
  postId: z.string().uuid('Invalid post ID'),
  buildingId: z.string().uuid('Invalid building ID'),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(5000).optional(),
});

export const PinBulletinPostSchema = z.object({
  postId: z.string().uuid('Invalid post ID'),
  buildingId: z.string().uuid('Invalid building ID'),
  pinned: z.boolean(),
});

export const DeleteBulletinPostSchema = z.object({
  postId: z.string().uuid('Invalid post ID'),
  buildingId: z.string().uuid('Invalid building ID'),
});

export type CreateBulletinPostInput = z.infer<typeof CreateBulletinPostSchema>;
export type UpdateBulletinPostInput = z.infer<typeof UpdateBulletinPostSchema>;
export type PinBulletinPostInput = z.infer<typeof PinBulletinPostSchema>;
export type DeleteBulletinPostInput = z.infer<typeof DeleteBulletinPostSchema>;

export interface BulletinPost {
  id: string;
  buildingId: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  pinned: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulletinFeedParams {
  buildingId: string;
  limit?: number;
  offset?: number;
}
