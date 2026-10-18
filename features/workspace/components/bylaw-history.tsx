import { diffBylawText, type DiffSegment } from '@/lib/bylaw-diff';

export type BylawVersionEntry = {
  id: string;
  version: number;
  status: string;
  body: string;
  created_at: string;
};

/**
 * The version history of one bylaw, newest first. Each version after the first can be compared with the one before it.
 * Comparisons use native disclosure elements, so they work with the keyboard and with screen readers.
 */
export function BylawVersionHistory({ versions }: { versions: BylawVersionEntry[] }) {
  if (versions.length === 0) {
    return (
      <section aria-labelledby="bylaw-history-heading" className="bylaw-history">
        <h3 id="bylaw-history-heading">Version history</h3>
        <p className="muted">No versions yet. Save the first version to start the history.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="bylaw-history-heading" className="bylaw-history">
      <h3 id="bylaw-history-heading">Version history</h3>
      <ol className="bylaw-history-list">
        {versions.map((entry, index) => {
          const before = versions[index + 1];
          return (
            <li key={entry.id}>
              <p>
                <strong>Version {entry.version}</strong> · {entry.status.replace(/_/g, ' ')} ·{' '}
                {new Date(entry.created_at).toLocaleDateString()}
              </p>
              {before ? (
                <details>
                  <summary>Compare with version {before.version}</summary>
                  <BylawDiff before={before} after={entry} />
                </details>
              ) : (
                <p className="muted">First version of this section.</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BylawDiff({ before, after }: { before: BylawVersionEntry; after: BylawVersionEntry }) {
  const diff = diffBylawText(before.body, after.body);

  if (diff.truncated) {
    return (
      <div>
        <p className="muted">
          This comparison is too long to mark word by word. Both versions are shown in full.
        </p>
        <p>
          <strong>Version {before.version}</strong>
        </p>
        <p className="bylaw-diff-text">{before.body}</p>
        <p>
          <strong>Version {after.version}</strong>
        </p>
        <p className="bylaw-diff-text">{after.body}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="muted">Added text is underlined. Removed text is struck through.</p>
      <p className="bylaw-diff-text">
        {diff.segments.length === 0 ? <span className="muted">Both versions are empty.</span> : null}
        {diff.segments.map((segment, i) => renderSegment(segment, i))}
      </p>
    </div>
  );
}

function renderSegment(segment: DiffSegment, key: number) {
  if (segment.kind === 'added') return <ins key={key}>{segment.text}</ins>;
  if (segment.kind === 'removed') return <del key={key}>{segment.text}</del>;
  return <span key={key}>{segment.text}</span>;
}
