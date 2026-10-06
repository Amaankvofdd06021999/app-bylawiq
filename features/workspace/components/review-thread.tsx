'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useBackend } from '@/components/backend';
import type { Row } from '@/lib/schema';
import { str } from '@/lib/rows';
export function ReviewThread({
  buildingId,
  documentId,
  comments,
  canComment,
}: {
  buildingId: string;
  documentId: string;
  comments: Row[];
  canComment: boolean;
}) {
  const router = useRouter(),
    backend = useBackend();
  const [body, setBody] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const mine = comments
    .filter((c) => str(c, 'document_id') === documentId)
    .sort((a, b) => str(a, 'created_at').localeCompare(str(b, 'created_at')));
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await backend.mutate({
      buildingId,
      operation: 'notice.comment',
      id: documentId,
      values: { body },
    });
    setBusy(false);
    if (r.ok) {
      setBody('');
      router.refresh();
    } else setError(r.error);
  }
  return (
    <section aria-labelledby={'thread-' + documentId} style={{ marginTop: 24 }}>
      <h3 id={'thread-' + documentId}>Review comments</h3>
      {mine.length ? (
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {mine.map((c) => (
            <li key={c.id} className="card">
              <p style={{ whiteSpace: 'pre-wrap' }}>{str(c, 'body')}</p>
              <span className="form-note">{str(c, 'created_at').slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="form-note">No comments yet.</p>
      )}
      {canComment && (
        <form onSubmit={send} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <label>
            Add a comment
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Post comment'}
          </Button>
        </form>
      )}
    </section>
  );
}
