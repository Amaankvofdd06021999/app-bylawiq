'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { getPendingReviewsAction } from '../document-approval-actions';
import { ApproveDocumentModal } from './approve-document-modal';
import { RequestChangesModal } from './request-changes-modal';

interface PendingReview {
  id: string;
  documentId: string;
  buildingId: string;
  status: 'pending' | 'changes_requested';
  comment?: string;
  changesRequestedCount: number;
  createdAt: string;
  document?: {
    title: string;
  };
  building?: {
    name: string;
  };
  submitter?: {
    display_name: string;
  };
}

interface ReviewInboxProps {
  orgId: string;
  userId: string;
}

export function ReviewInbox({ orgId, userId }: ReviewInboxProps) {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'request' | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const result = await getPendingReviewsAction({ limit: 100 });

      if (result.ok) {
        setReviews(result.reviews || []);
      } else {
        setError(result.error || 'Failed to load reviews');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setModalMode(null);
    setSelectedReview(null);
    loadReviews(); // Refresh the list
  };

  const daysWaiting = (createdAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  if (loading) {
    return <div className="loading">Loading reviews...</div>;
  }

  if (reviews.length === 0) {
    return (
      <Card className="empty-state">
        <CheckCircle size={48} className="icon" />
        <h2>All Caught Up!</h2>
        <p>No pending document reviews. Great job staying on top of things.</p>
      </Card>
    );
  }

  return (
    <div className="inbox">
      {error && <div className="error-message">{error}</div>}

      <div className="review-list">
        {reviews.map((review) => (
          <div key={review.id} className={`review-card ${review.status}`}>
            <div className="review-header">
              <div className="review-info">
                <h3 className="doc-title">{review.document?.title}</h3>
                <p className="building-name">
                  Building: {review.building?.name}
                </p>
                <p className="submitter">
                  Submitted by: {review.submitter?.display_name}
                </p>
              </div>

              <div className="status-indicator">
                {review.status === 'pending' ? (
                  <div className="pending-badge">
                    <Clock size={14} />
                    Pending
                  </div>
                ) : (
                  <div className="changes-badge">
                    <AlertCircle size={14} />
                    Changes Requested
                  </div>
                )}
              </div>
            </div>

            {review.comment && (
              <div className="comment-section">
                <p className="comment-label">Feedback:</p>
                <p className="comment-text">{review.comment}</p>
              </div>
            )}

            <div className="review-meta">
              <span className="waiting-time">
                {daysWaiting(review.createdAt)} day
                {daysWaiting(review.createdAt) !== 1 ? 's' : ''} waiting
              </span>
              {review.changesRequestedCount > 0 && (
                <span className="changes-count">
                  {review.changesRequestedCount} revision request
                  {review.changesRequestedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="actions">
              <Button
                onClick={() => {
                  setSelectedReview(review);
                  setModalMode('approve');
                }}
                className="approve-btn"
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  setSelectedReview(review);
                  setModalMode('request');
                }}
                variant="secondary"
              >
                Request Changes
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selectedReview && modalMode === 'approve' && (
        <ApproveDocumentModal
          documentId={selectedReview.documentId}
          buildingId={selectedReview.buildingId}
          onClose={handleModalClose}
        />
      )}

      {selectedReview && modalMode === 'request' && (
        <RequestChangesModal
          documentId={selectedReview.documentId}
          buildingId={selectedReview.buildingId}
          onClose={handleModalClose}
        />
      )}

      <style jsx>{`
        .inbox {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .loading {
          padding: 2rem;
          text-align: center;
          color: #666;
        }

        .error-message {
          padding: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .empty-state .icon {
          color: #10b981;
          margin-bottom: 1rem;
        }

        .empty-state h2 {
          margin: 0.5rem 0;
          color: #1f2937;
        }

        .empty-state p {
          margin: 0;
        }

        .review-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .review-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
          transition: all 0.2s;
        }

        .review-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .review-card.changes_requested {
          border-color: #fecaca;
          background: #fefce8;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .review-info {
          flex: 1;
        }

        .doc-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .building-name,
        .submitter {
          margin: 0.25rem 0;
          font-size: 0.875rem;
          color: #666;
        }

        .status-indicator {
          flex-shrink: 0;
        }

        .pending-badge,
        .changes-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .pending-badge {
          background: #dbeafe;
          color: #1e40af;
        }

        .changes-badge {
          background: #fed7aa;
          color: #b45309;
        }

        .comment-section {
          padding: 1rem;
          background: #f9fafb;
          border-left: 3px solid #f59e0b;
          border-radius: 4px;
          margin-bottom: 1rem;
        }

        .comment-label {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
        }

        .comment-text {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
          line-height: 1.5;
        }

        .review-meta {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.8rem;
        }

        .waiting-time {
          color: #666;
          font-weight: 600;
        }

        .changes-count {
          color: #f59e0b;
          font-weight: 600;
        }

        .actions {
          display: flex;
          gap: 1rem;
        }

        .approve-btn {
          background: #10b981;
        }

        .approve-btn:hover {
          background: #059669;
        }
      `}</style>
    </div>
  );
}
