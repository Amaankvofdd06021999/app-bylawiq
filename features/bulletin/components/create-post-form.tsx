'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { createBulletinPostAction } from '../bulletin-actions';

interface CreatePostFormProps {
  buildingId: string;
  onSuccess?: () => void;
}

const MAX_TITLE = 120;
const MAX_BODY = 5000;

export function CreatePostForm({ buildingId, onSuccess }: CreatePostFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const titleLength = title.length;
  const bodyLength = body.length;
  const isValid = title.trim().length > 0 && body.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValid) {
      setError('Title and body are required');
      return;
    }

    if (titleLength > MAX_TITLE) {
      setError('Title is too long');
      return;
    }

    if (bodyLength > MAX_BODY) {
      setError('Body is too long');
      return;
    }

    setIsLoading(true);
    const result = await createBulletinPostAction({
      buildingId,
      title,
      body,
    });

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Please try again.');
      setIsLoading(false);
      return;
    }

    setTitle('');
    setBody('');
    setIsLoading(false);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder="Enter post title"
          disabled={isLoading}
          maxLength={MAX_TITLE}
        />
        <div className="char-count">
          {titleLength} / {MAX_TITLE}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="body">Content</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder="Share important information with your community"
          disabled={isLoading}
          maxLength={MAX_BODY}
          rows={6}
        />
        <div className="char-count">
          {bodyLength} / {MAX_BODY}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <Button type="submit" disabled={!isValid || isLoading} busy={isLoading}>
        {isLoading ? 'Posting...' : 'Post to Bulletin'}
      </Button>

      <style jsx>{`
        .form {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          font-size: 0.95rem;
          color: #1f2937;
        }

        .form-group input,
        .form-group textarea {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.95rem;
          color: #1f2937;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group input:disabled,
        .form-group textarea:disabled {
          background: #f9fafb;
          color: #999;
          cursor: not-allowed;
        }

        .char-count {
          font-size: 0.8rem;
          color: #999;
          text-align: right;
        }

        .char-count.warning {
          color: #f59e0b;
        }

        .char-count.error {
          color: #dc2626;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        @media (max-width: 640px) {
          .form {
            padding: 1rem;
          }
        }
      `}</style>
    </form>
  );
}
