'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import {
  publishFirmDocumentAction,
  searchFirmKnowledgeAction,
  type SearchHit,
} from '@/features/firm-knowledge/actions';

const KIND_LABELS: Record<string, string> = {
  template: 'Template',
  policy: 'Policy',
  precedent: 'Precedent',
  research: 'Research',
  guide: 'Guide',
};
const MAX_FILE_BYTES = 200_000;

export type FirmLibraryDocument = { id: string; title: string; kind: string; publishedAt: string | null };

/**
 * The firm's knowledge library: publish a document (pasted text, or a .txt or .md file), see what is published, and
 * search it. Each action is checked by the database for the caller's firm role or membership.
 */
export function FirmLibrary({ firmId, documents }: { firmId: string; documents: FirmLibraryDocument[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('policy');
  const [text, setText] = useState('');
  const [publishError, setPublishError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searchError, setSearchError] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPublishError('That file is larger than 200 KB. Paste the text instead, or split the document.');
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name)) {
      setPublishError('Upload a .txt or .md file, or paste the text.');
      return;
    }
    setPublishError('');
    setText(await file.text());
    if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ''));
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPublishError('');
    setNotice('');
    const result = await publishFirmDocumentAction({ firmId, title, kind, text });
    setBusy(false);
    if (result.ok) {
      setNotice(`Published “${title}”. It is now searchable by your firm.`);
      setTitle('');
      setText('');
      router.refresh();
    } else setPublishError(result.error);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError('');
    const result = await searchFirmKnowledgeAction({ firmId, query });
    if (result.ok) setHits(result.hits);
    else {
      setHits(null);
      setSearchError(result.error);
    }
  }

  return (
    <section className="card" aria-labelledby="firm-library-heading" style={{ marginTop: 32 }}>
      <h2 id="firm-library-heading">Firm knowledge</h2>
      <p className="form-note">
        Templates and guidance your team can search. Each document is split into paragraphs.
      </p>

      <form onSubmit={publish} className="form-stack" style={{ marginTop: 16 }}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} required />
        </label>
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Upload a .txt or .md file
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <label>
          Or paste the text
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
        </label>
        <Button busy={busy}>Publish to firm knowledge</Button>
      </form>
      {publishError && (
        <p role="alert" className="form-error" style={{ marginTop: 12 }}>
          {publishError}
        </p>
      )}
      {notice && (
        <p role="status" className="form-note" style={{ marginTop: 12 }}>
          {notice}
        </p>
      )}

      {documents.length > 0 && (
        <ul style={{ marginTop: 20 }} aria-label="Published firm documents">
          {documents.map((d) => (
            <li key={d.id}>
              <strong>{d.title}</strong> · {KIND_LABELS[d.kind] ?? d.kind}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={search} className="form-stack" style={{ marginTop: 24 }} role="search">
        <label>
          Search firm knowledge
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            maxLength={200}
          />
        </label>
        <Button variant="secondary">Search</Button>
      </form>
      {searchError && (
        <p role="alert" className="form-error" style={{ marginTop: 12 }}>
          {searchError}
        </p>
      )}
      {hits && (
        <div style={{ marginTop: 16 }}>
          {hits.length === 0 ? (
            <p className="form-note">No firm documents match “{query}”.</p>
          ) : (
            <ul aria-label="Search results">
              {hits.map((h, i) => (
                <li key={`${h.documentId}-${i}`} style={{ marginBottom: 12 }}>
                  <strong>{h.title}</strong> · {KIND_LABELS[h.kind] ?? h.kind}
                  <blockquote>{h.content}</blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
