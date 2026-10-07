'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { approveDocumentAction } from '../document-approval-actions';

interface ApproveDocumentModalProps {
  documentId: string;
  buildingId: string;
  onClose: () => void;
}

export function ApproveDocumentModal({
  documentId,
  buildingId,
  onClose,
}: ApproveDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    try {
      setLoading(true);
      const result = await approveDocumentAction({
        documentId,
        buildingId,
      });

      if (result.ok) {
        onClose();
      } else {
        setError(result.error || 'Failed to approve document');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error approving document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Approve Document</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <p>Are you sure you want to approve this document?</p>
          <p className="note">
            Once approved, you can send it to the recipient on behalf of the
            building.
          </p>
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={loading} busy={loading}>
            {loading ? 'Approving...' : 'Approve Document'}
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
          max-width: 500px;
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
        }

        .modal-body p {
          margin: 0.5rem 0;
          color: #374151;
        }

        .modal-body .note {
          font-size: 0.875rem;
          color: #666;
          font-style: italic;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
          margin-bottom: 1rem;
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
