'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Library, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Empty, Modal, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import { shortDate } from '@/lib/dates';
import type { FirmCollectionId, FirmDocView, FirmKnowledgeData } from '../types';
const date = shortDate;
type Editing = { id?: string; collection: FirmCollectionId; title: string; body: string };
/** The Knowledge section's Firm tab: the firm's four collections. Owners, admins and portfolio managers add, edit
 * and delete; assistants read. Saved documents are answerable in Ask for the firm's staff straight away. */
export function FirmKnowledge({
  data,
  initialCollection,
}: {
  data: FirmKnowledgeData;
  initialCollection?: string;
}) {
  const router = useRouter(),
    backend = useBackend();
  const [filter, setFilter] = useState<FirmCollectionId | 'all'>(() =>
    data.collections.some((c) => c.id === initialCollection)
      ? (initialCollection as FirmCollectionId)
      : 'all',
  );
  const [editing, setEditing] = useState<Editing | null>(null),
    [removing, setRemoving] = useState<FirmDocView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [open, setOpen] = useState<string | null>(null);
  const shown = data.collections.filter((c) => filter === 'all' || c.id === filter);
  const total = data.collections.reduce((n, c) => n + c.docs.length, 0);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    const r = await backend.saveFirmDoc(editing);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError('');
    const r = await backend.deleteFirmDoc({ id: removing.id });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setRemoving(null);
    router.refresh();
  }
  return (
    <>
      <PageHeading
        eyebrow={data.firm.name.toUpperCase()}
        title="Firm knowledge"
        description="Templates, policies, guidance notes and the CRT and legislation tracker your team works from."
      />
      <div className="inline-callout firm-note">
        <Lock size={14} aria-hidden /> Internal to {data.firm.name} staff. This is how your firm works — not
        law and not any building’s bylaws. Residents, building managers and council never see it.
      </div>
      <div className="toolbar">
        <div className="tab-filter" role="group" aria-label="Collections">
          <button
            type="button"
            aria-pressed={filter === 'all'}
            className={filter === 'all' ? 'selected' : ''}
            onClick={() => setFilter('all')}
          >
            All · {total}
          </button>
          {data.collections.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={filter === c.id}
              className={filter === c.id ? 'selected' : ''}
              onClick={() => setFilter(c.id)}
            >
              {c.label} · {c.docs.length}
            </button>
          ))}
        </div>
        {data.canEdit ? (
          <Button
            onClick={() => {
              setError('');
              setEditing({ collection: filter === 'all' ? 'templates' : filter, title: '', body: '' });
            }}
          >
            <Plus size={15} aria-hidden />
            Add firm document
          </Button>
        ) : (
          <Badge>Read only</Badge>
        )}
      </div>
      {!data.canEdit && (
        <p className="form-note" style={{ marginBottom: 16 }}>
          You can read and use firm knowledge. Ask your portfolio manager to change it.
        </p>
      )}
      {shown.map((c) => (
        <section key={c.id} className="firm-collection" aria-labelledby={'fc-' + c.id}>
          <div className="section-title">
            <h2 id={'fc-' + c.id}>{c.label}</h2>
            <Badge>{c.docs.length}</Badge>
          </div>
          {c.docs.length ? (
            <div className="card firm-docs">
              {c.docs.map((d) => (
                <article key={d.id} className="firm-doc">
                  <div className="firm-doc-top">
                    <div>
                      <h3>{d.title}</h3>
                      <p className="form-note">
                        Updated {date(d.updatedAt)} · by {d.author} · {d.parts} part{d.parts === 1 ? '' : 's'}{' '}
                        searchable in Ask
                      </p>
                    </div>
                    <div className="action-line">
                      <Button
                        variant="ghost"
                        size="small"
                        aria-expanded={open === d.id}
                        onClick={() => setOpen(open === d.id ? null : d.id)}
                      >
                        {open === d.id ? 'Hide' : 'Read'}
                      </Button>
                      {data.canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="small"
                            aria-label={'Edit ' + d.title}
                            onClick={() => {
                              setError('');
                              setEditing({
                                id: d.id,
                                collection: d.collection,
                                title: d.title,
                                body: d.body,
                              });
                            }}
                          >
                            <Pencil size={14} aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            aria-label={'Delete ' + d.title}
                            onClick={() => {
                              setError('');
                              setRemoving(d);
                            }}
                          >
                            <Trash2 size={14} aria-hidden />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {open === d.id && <pre className="firm-doc-body">{d.body}</pre>}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Library />}
              title={`No ${c.label.toLowerCase()} yet`}
              description={
                data.canEdit
                  ? 'Add the first one. It becomes searchable in Ask for your firm’s staff.'
                  : 'Your firm hasn’t added any yet.'
              }
            />
          )}
        </section>
      ))}
      <Modal
        open={editing != null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        title={editing?.id ? 'Edit firm document' : 'Add a firm document'}
        description={`Only ${data.firm.name} staff can see this.`}
        wide
      >
        {editing && (
          <form className="form-stack" onSubmit={save}>
            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
                maxLength={160}
              />
            </label>
            <label>
              Collection
              <select
                value={editing.collection}
                onChange={(e) => setEditing({ ...editing, collection: e.target.value as FirmCollectionId })}
              >
                {data.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                required
                minLength={20}
                maxLength={20000}
                rows={12}
              />
              <span className="form-note">
                Separate parts with a blank line — each part is searched and cited on its own. Keep precedents
                anonymised: use placeholders like [owner name] and [unit], never real names, unit numbers or
                email addresses.
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-footer">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                {editing.id ? 'Save changes' : 'Add document'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={removing != null}
        onOpenChange={(v) => {
          if (!v) setRemoving(null);
        }}
        title="Delete this firm document?"
        description="It stops appearing in your staff’s answers straight away."
      >
        <div className="form-stack">
          <p className="form-note">
            “{removing?.title}” will be removed for everyone at {data.firm.name}.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Delete document
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
/** Building · Firm tabs at the top of the Knowledge section. Only rendered for firm staff: everyone else sees
 * the building's knowledge bases alone, with no sign that a firm tab exists. */
export function KnowledgeTabs({ buildingId, active }: { buildingId: string; active: 'building' | 'firm' }) {
  const { base } = useBackend();
  const href = (tab: string) => `${base}/b/${buildingId}/knowledge?tab=${tab}`;
  return (
    <nav aria-label="Knowledge" className="tab-filter knowledge-tabs">
      {(
        [
          ['building', 'Building knowledge'],
          ['firm', 'Firm knowledge'],
        ] as const
      ).map(([tab, label]) => (
        <Link
          key={tab}
          href={href(tab)}
          className={active === tab ? 'selected' : ''}
          aria-current={active === tab ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
