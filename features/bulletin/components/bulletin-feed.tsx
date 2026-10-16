'use client';
import { Pin } from 'lucide-react';
import type { BulletinPost } from '../bulletin-schema';

interface BulletinFeedProps {
  posts: BulletinPost[];
  isStaff?: boolean;
  onPin?: (postId: string, pinned: boolean) => void;
  onEdit?: (post: BulletinPost) => void;
  onDelete?: (postId: string) => void;
}

export function BulletinFeed({ posts, isStaff = false, onPin, onEdit, onDelete }: BulletinFeedProps) {
  if (posts.length === 0) {
    return (
      <div className="empty-state">
        <p>No bulletin posts yet.</p>
        {isStaff && <p className="hint">Create one to get started.</p>}
      </div>
    );
  }

  return (
    <div className="feed">
      {/* Pinned first, then the order given (the server sorts newest first). Array sort is stable. */}
      {[...posts]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
        .map((post) => (
          <article key={post.id} className="post">
            <div className="post-header">
              <div className="post-title-row">
                {post.pinned && (
                  <span className="pinned-badge">
                    <Pin size={14} /> Pinned
                  </span>
                )}
                <h3 className="post-title">{post.title}</h3>
              </div>
              {isStaff && (
                <div className="post-actions">
                  {onPin && (
                    <button
                      className="action-btn"
                      onClick={() => onPin(post.id, !post.pinned)}
                      title={post.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={16} />
                    </button>
                  )}
                  {onEdit && (
                    <button className="action-btn" onClick={() => onEdit(post)} title="Edit">
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button className="action-btn delete" onClick={() => onDelete(post.id)} title="Delete">
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="post-meta">
              <span className="author">By {post.authorName}</span>
              <span className="date">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="post-body">{post.body}</div>
          </article>
        ))}

      <style jsx>{`
        .feed {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #666;
        }

        .empty-state p {
          margin: 0.5rem 0;
        }

        .empty-state .hint {
          font-size: 0.875rem;
          color: #999;
        }

        .post {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
          transition: box-shadow 0.2s;
        }

        .post:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .post-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .pinned-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #fef3c7;
          color: #b45309;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .post-title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .post-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .action-btn {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #374151;
        }

        .action-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .action-btn.delete {
          color: #dc2626;
        }

        .action-btn.delete:hover {
          background: #fef2f2;
          border-color: #dc2626;
        }

        .post-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: #666;
          margin-bottom: 1rem;
        }

        .author {
          font-weight: 500;
        }

        .date {
          color: #999;
        }

        .post-body {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #374151;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        @media (max-width: 640px) {
          .post {
            padding: 1rem;
          }

          .post-header {
            flex-direction: column;
          }

          .post-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
