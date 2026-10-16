'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { requestDocumentChangesAction } from '../document-approval-actions';

interface RequestChangesModalProps {
  documentId: string;
  buildingId: string;
  onClose: () => void;
}

export function RequestChangesModal({ documentId, buildingId, onClose }: RequestChangesModalProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async () => {
    if (!comment.trim()) {
      setError('Please provide feedback on what needs to change');
      return;
    }

    try {
      setLoading(true);
      const result = await requestDocumentChangesAction({
        documentId,
        buildingId,
        comment,
      });

      if (result.ok) {
        onClose();
      } else {
        setError(result.error || 'Failed to request changes');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error requesting changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Changes</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="comment">Your Feedback</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe what changes are needed..."
              rows={5}
              disabled={loading}
              maxLength={1000}
              className="textarea"
            />
            <p className="char-count">{comment.length} / 1000 characters</p>
          </div>

          <p className="info">
            The document will be returned to the author for revision. They’ll see your feedback and can make
            changes before resubmitting.
          </p>
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleRequest} disabled={loading || !comment.trim()} busy={loading}>
            {loading ? 'Sending...' : 'Request Changes'}
          </Button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 8px;
          max-width: 600px;
          width: 90%;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #1f2937;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #666;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #1f2937;
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #1f2937;
          font-size: 0.95rem;
        }

        .textarea {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
        }

        .textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .textarea:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .char-count {
          margin: 0;
          font-size: 0.75rem;
          color: #999;
          text-align: right;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .info {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}
