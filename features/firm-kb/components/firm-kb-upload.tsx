'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { Upload, FileText, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface FirmKBItem {
  id: string;
  title: string;
  type: 'template' | 'precedent' | 'policy' | 'guidance';
  content: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface FirmKBUploadProps {
  orgId: string;
  onUploadSuccess?: () => void;
}

export function FirmKBUpload({ orgId, onUploadSuccess }: FirmKBUploadProps) {
  const [items, setItems] = useState<FirmKBItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<FirmKBItem['type']>('template');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddItem = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/firm-kb/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          title,
          type,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const newItem = await response.json();
      setItems([...items, newItem]);
      setTitle('');
      setContent('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Delete this item from firm knowledge base?')) return;

    try {
      const response = await fetch(`/api/firm-kb/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setItems(items.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const typeLabels: Record<FirmKBItem['type'], string> = {
    template: '📋 Template',
    precedent: '📚 Precedent',
    policy: '📄 Policy',
    guidance: '💡 Guidance',
  };

  return (
    <div className="firm-kb-upload">
      <div className="upload-section">
        <Card className="upload-form">
          <h3>Add to Firm Knowledge Base</h3>
          <p className="subtitle">Store reusable templates, precedents, and policies</p>

          {success && (
            <div className="success-message">
              <CheckCircle size={18} />
              <span>Added to knowledge base</span>
            </div>
          )}

          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Title</label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Quiet Hours Bylaw Amendment'"
              disabled={isUploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as FirmKBItem['type'])}
              disabled={isUploading}
            >
              <option value="template">📋 Template</option>
              <option value="precedent">📚 Precedent (Past Document)</option>
              <option value="policy">📄 Policy</option>
              <option value="guidance">💡 Guidance</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="content">Content</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the template, precedent, or policy text here..."
              rows={8}
              disabled={isUploading}
            />
            <p className="char-count">
              {content.length} / 50,000 characters
            </p>
          </div>

          <div className="form-actions">
            <Button
              onClick={handleAddItem}
              disabled={isUploading || !title.trim() || !content.trim()}
              className="primary"
            >
              <Plus size={18} />
              {isUploading ? 'Adding...' : 'Add to Knowledge Base'}
            </Button>
          </div>
        </Card>
      </div>

      {items.length > 0 && (
        <div className="items-section">
          <h3>Firm Knowledge Base ({items.length})</h3>

          <div className="items-list">
            {items.map((item) => (
              <Card key={item.id} className="item-card">
                <div className="item-header">
                  <span className="item-type">{typeLabels[item.type]}</span>
                  <h4>{item.title}</h4>
                </div>

                <p className="item-content">{item.content.slice(0, 200)}...</p>

                <div className="item-footer">
                  <p className="item-meta">
                    Added by {item.uploadedBy} on{' '}
                    {new Date(item.uploadedAt).toLocaleDateString()}
                  </p>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .firm-kb-upload {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .upload-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .upload-form {
          padding: 2rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .upload-form h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .subtitle {
          margin: 0 0 1.5rem 0;
          color: #666;
          font-size: 0.875rem;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 6px;
          color: #15803d;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.95rem;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 150px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .char-count {
          margin: 0;
          font-size: 0.75rem;
          color: #999;
          text-align: right;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
        }

        .primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .items-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .items-section h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .items-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .item-card {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .item-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .item-type {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #f3f4f6;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .item-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
          flex: 1;
        }

        .item-content {
          margin: 0;
          color: #666;
          font-size: 0.875rem;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .item-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .item-meta {
          margin: 0;
          font-size: 0.75rem;
          color: #999;
        }

        .delete-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          color: #dc2626;
          font-size: 0.75rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .delete-btn:hover {
          background: #fef2f2;
          border-color: #fecaca;
        }
      `}</style>
    </div>
  );
}
