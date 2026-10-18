import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BylawVersionHistory, type BylawVersionEntry } from './bylaw-history';

const v = (version: number, body: string): BylawVersionEntry => ({
  id: `v${version}`,
  version,
  status: 'draft',
  body,
  created_at: '2026-10-01T10:00:00Z',
});

describe('BylawVersionHistory', () => {
  it('shows an empty state when the bylaw has no versions', () => {
    render(<BylawVersionHistory versions={[]} />);
    expect(screen.getByRole('heading', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByText(/No versions yet/)).toBeInTheDocument();
  });

  it('marks the first version and offers a comparison for each later one', () => {
    render(<BylawVersionHistory versions={[v(2, 'Two pets or three.'), v(1, 'Two pets.')]} />);
    expect(screen.getByText('Compare with version 1')).toBeInTheDocument();
    expect(screen.getByText('First version of this section.')).toBeInTheDocument();
  });

  it('shows both versions in full when the comparison is too large to mark', () => {
    const big = Array.from({ length: 3000 }, (_, i) => `word${i}`).join(' ');
    const other = Array.from({ length: 3000 }, (_, i) => `term${i}`).join(' ');
    const { container } = render(<BylawVersionHistory versions={[v(2, other), v(1, big)]} />);
    expect(screen.getByText(/too long to mark word by word/)).toBeInTheDocument();
    expect(container.querySelectorAll('.bylaw-diff-text')).toHaveLength(2);
    expect(container.querySelector('del')).toBeNull();
  });
});
