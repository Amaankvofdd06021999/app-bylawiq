import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BylawLintPanel } from './bylaw-lint-panel';

describe('BylawLintPanel', () => {
  it('renders nothing for an empty body', () => {
    const { container } = render(<BylawLintPanel body="   " isAmendment={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states that the checks are advisory and not legal approval', () => {
    render(<BylawLintPanel body="Quiet hours run from 10 pm to 7 am." isAmendment={false} />);
    expect(screen.getByRole('heading', { name: 'Advisory checks' })).toBeInTheDocument();
    expect(screen.getByText(/not legal approval/)).toBeInTheDocument();
    expect(screen.getByText('No checks raised for this text.')).toBeInTheDocument();
  });

  it('writes the severity out in words, not colour alone', () => {
    render(<BylawLintPanel body="Owners must not rent their units to tenants." isAmendment={false} />);
    expect(screen.getByText('Blocker:')).toBeInTheDocument();
    expect(
      screen.getByText('Owners must not rent their units to tenants.', { selector: 'q' }),
    ).toBeInTheDocument();
  });
});
