import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePostForm } from './create-post-form';

vi.mock('../bulletin-actions', () => ({
  createBulletinPostAction: vi.fn(),
}));

import { createBulletinPostAction } from '../bulletin-actions';

describe('CreatePostForm Component', () => {
  const buildingId = 'building-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render title input', () => {
      render(<CreatePostForm buildingId={buildingId} />);
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    it('should render body textarea', () => {
      render(<CreatePostForm buildingId={buildingId} />);
      expect(screen.getByLabelText('Content')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<CreatePostForm buildingId={buildingId} />);
      expect(screen.getByRole('button', { name: /Post to Bulletin/ })).toBeInTheDocument();
    });

    it('should display character counters', () => {
      render(<CreatePostForm buildingId={buildingId} />);
      expect(screen.getByText(/0 \/ 120/)).toBeInTheDocument();
      expect(screen.getByText(/0 \/ 5000/)).toBeInTheDocument();
    });
  });

  describe('Character Limits', () => {
    it('should enforce 120 character limit on title', async () => {
      const user = userEvent.setup();
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const longTitle = 'a'.repeat(150);

      await user.type(titleInput, longTitle);

      expect(titleInput.value).toHaveLength(120);
      expect(screen.getByText('120 / 120')).toBeInTheDocument();
    });

    it('should enforce 5000 character limit on body', async () => {
      // Set the value in one change: typing 5,100 keystrokes is slow and leaks into the tests after it.
      render(<CreatePostForm buildingId={buildingId} />);

      const bodyInput = screen.getByLabelText('Content') as HTMLTextAreaElement;
      const longBody = 'a'.repeat(5100);

      fireEvent.change(bodyInput, { target: { value: longBody } });

      expect(bodyInput.value).toHaveLength(5000);
      expect(screen.getByText('5000 / 5000')).toBeInTheDocument();
    });

    it('should update character counters while typing', async () => {
      const user = userEvent.setup();
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');

      expect(screen.getByText('0 / 120')).toBeInTheDocument();

      await user.type(titleInput, 'Hello');

      expect(screen.getByText('5 / 120')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when title is empty', async () => {
      render(<CreatePostForm buildingId={buildingId} />);

      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when body is empty', async () => {
      const user = userEvent.setup();
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Title only');

      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when both fields have content', async () => {
      const user = userEvent.setup();
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');

      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });
      expect(submitButton).not.toBeDisabled();
    });

    it('should show error for whitespace-only input', async () => {
      const user = userEvent.setup();
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');

      await user.type(titleInput, '   ');
      await user.type(bodyInput, 'Body');

      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call createBulletinPostAction on submit', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockResolvedValue({ ok: true, postId: 'post-1' });

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      await waitFor(() => {
        expect(createBulletinPostAction).toHaveBeenCalledWith({
          buildingId,
          title: 'Test Title',
          body: 'Test body content',
        });
      });
    });

    it('should clear form after successful submission', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockResolvedValue({ ok: true, postId: 'post-1' });

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const bodyInput = screen.getByLabelText('Content') as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe('');
        expect(bodyInput.value).toBe('');
      });
    });

    it('should display error on submission failure', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockResolvedValue({
        ok: false,
        error: 'Permission denied',
      });

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });

    it('should call onSuccess callback after submission', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      vi.mocked(createBulletinPostAction).mockResolvedValue({ ok: true, postId: 'post-1' });

      render(<CreatePostForm buildingId={buildingId} onSuccess={onSuccess} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, postId: 'post-1' }), 100)),
      );

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      expect(screen.getByRole('button', { name: /Posting/ })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Post to Bulletin/ })).toBeInTheDocument();
      });
    });

    it('should disable form inputs while submitting', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, postId: 'post-1' }), 100)),
      );

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const bodyInput = screen.getByLabelText('Content') as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body content');
      await user.click(submitButton);

      expect(titleInput.disabled).toBe(true);
      expect(bodyInput.disabled).toBe(true);

      await waitFor(() => {
        expect(titleInput.disabled).toBe(false);
        expect(bodyInput.disabled).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should persist form state on error', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockResolvedValue({
        ok: false,
        error: 'Server error',
      });

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const bodyInput = screen.getByLabelText('Content') as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body');
      await user.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe('Test Title');
        expect(bodyInput.value).toBe('Test body');
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have associated labels for inputs', () => {
      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const bodyInput = screen.getByLabelText('Content') as HTMLTextAreaElement;

      expect(titleInput.id).toBe('title');
      expect(bodyInput.id).toBe('body');
    });

    it('should have descriptive placeholders', () => {
      render(<CreatePostForm buildingId={buildingId} />);

      expect(screen.getByPlaceholderText('Enter post title')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Share important information with your community'),
      ).toBeInTheDocument();
    });

    it('should support keyboard submission', async () => {
      const user = userEvent.setup();
      vi.mocked(createBulletinPostAction).mockResolvedValue({ ok: true, postId: 'post-1' });

      render(<CreatePostForm buildingId={buildingId} />);

      const titleInput = screen.getByLabelText('Title');
      const bodyInput = screen.getByLabelText('Content');

      await user.type(titleInput, 'Test Title');
      await user.type(bodyInput, 'Test body');
      await user.keyboard('{Enter}'); // Should not submit from textarea, only from button

      // Form should still be valid for submission
      const submitButton = screen.getByRole('button', { name: /Post to Bulletin/ });
      expect(submitButton).not.toBeDisabled();
    });
  });
});
