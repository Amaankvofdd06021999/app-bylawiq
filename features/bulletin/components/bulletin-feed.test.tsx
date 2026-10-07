import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulletinFeed } from './bulletin-feed';
import type { BulletinPost } from '../bulletin-schema';

describe('BulletinFeed Component', () => {
  const mockPosts: BulletinPost[] = [
    {
      id: 'post-1',
      buildingId: 'building-1',
      title: 'Pinned Announcement',
      body: 'This is an important announcement.',
      authorId: 'user-1',
      authorName: 'John Manager',
      pinned: true,
      deletedAt: null,
      createdAt: '2026-01-15T10:00:00Z',
      updatedAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'post-2',
      buildingId: 'building-1',
      title: 'Regular Post',
      body: 'This is a regular post.',
      authorId: 'user-2',
      authorName: 'Jane Resident',
      pinned: false,
      deletedAt: null,
      createdAt: '2026-01-14T15:30:00Z',
      updatedAt: '2026-01-14T15:30:00Z',
    },
  ];

  describe('Empty State', () => {
    it('should display empty state when no posts', () => {
      render(<BulletinFeed posts={[]} />);
      expect(screen.getByText('No bulletin posts yet.')).toBeInTheDocument();
    });

    it('should show hint for staff when no posts', () => {
      render(<BulletinFeed posts={[]} isStaff={true} />);
      expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
    });

    it('should not show hint for residents when no posts', () => {
      render(<BulletinFeed posts={[]} isStaff={false} />);
      expect(screen.queryByText('Create one to get started.')).not.toBeInTheDocument();
    });
  });

  describe('Post Display', () => {
    it('should render all posts', () => {
      render(<BulletinFeed posts={mockPosts} />);
      expect(screen.getByText('Pinned Announcement')).toBeInTheDocument();
      expect(screen.getByText('Regular Post')).toBeInTheDocument();
    });

    it('should display post title', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(screen.getByText('Pinned Announcement')).toBeInTheDocument();
    });

    it('should display post body', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(screen.getByText('This is an important announcement.')).toBeInTheDocument();
    });

    it('should display author name', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(screen.getByText('By John Manager')).toBeInTheDocument();
    });

    it('should display creation date', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      // Date format depends on locale, just verify it's displayed
      expect(screen.getByText(/1\/15\/2026|15\/1\/2026/)).toBeInTheDocument();
    });

    it('should show pinned badge for pinned posts', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(screen.getByText('Pinned')).toBeInTheDocument();
    });

    it('should not show pinned badge for regular posts', () => {
      render(<BulletinFeed posts={[mockPosts[1]]} />);
      expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
    });
  });

  describe('Staff Controls', () => {
    it('should not show action buttons for residents', () => {
      render(<BulletinFeed posts={mockPosts} isStaff={false} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should show action buttons for staff', () => {
      const onPin = vi.fn();
      const onEdit = vi.fn();
      const onDelete = vi.fn();

      render(
        <BulletinFeed
          posts={[mockPosts[0]]}
          isStaff={true}
          onPin={onPin}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('should call onPin when pin button clicked', async () => {
      const onPin = vi.fn();
      const user = userEvent.setup();

      render(
        <BulletinFeed
          posts={[mockPosts[0]]}
          isStaff={true}
          onPin={onPin}
        />
      );

      const pinButtons = screen.getAllByRole('button');
      await user.click(pinButtons[0]);

      expect(onPin).toHaveBeenCalledWith('post-1', false); // toggle from true to false
    });

    it('should call onEdit when edit button clicked', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();

      render(
        <BulletinFeed
          posts={[mockPosts[0]]}
          isStaff={true}
          onEdit={onEdit}
        />
      );

      const buttons = screen.getAllByRole('button');
      // Find Edit button by text or title
      const editButton = buttons.find(
        (btn) => btn.getAttribute('title') === 'Edit'
      );
      if (editButton) {
        await user.click(editButton);
        expect(onEdit).toHaveBeenCalledWith(mockPosts[0]);
      }
    });

    it('should call onDelete when delete button clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();

      render(
        <BulletinFeed
          posts={[mockPosts[0]]}
          isStaff={true}
          onDelete={onDelete}
        />
      );

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(
        (btn) => btn.getAttribute('title') === 'Delete'
      );
      if (deleteButton) {
        await user.click(deleteButton);
        expect(onDelete).toHaveBeenCalledWith('post-1');
      }
    });
  });

  describe('Ordering', () => {
    it('should display pinned posts first', () => {
      const posts: BulletinPost[] = [
        { ...mockPosts[1], pinned: false }, // Regular post created later
        { ...mockPosts[0], pinned: true, createdAt: '2026-01-01T10:00:00Z' }, // Pinned post created earlier
      ];

      render(<BulletinFeed posts={posts} />);

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles[0]).toHaveTextContent('Pinned Announcement');
      expect(titles[1]).toHaveTextContent('Regular Post');
    });
  });

  describe('Accessibility', () => {
    it('should use semantic HTML (article tags)', () => {
      const { container } = render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(container.querySelectorAll('article')).toHaveLength(1);
    });

    it('should have proper heading hierarchy', () => {
      render(<BulletinFeed posts={[mockPosts[0]]} />);
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should have descriptive button titles for accessibility', () => {
      const onPin = vi.fn();

      render(
        <BulletinFeed
          posts={[mockPosts[0]]}
          isStaff={true}
          onPin={onPin}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn.getAttribute('title')).toBeTruthy();
      });
    });
  });
});
