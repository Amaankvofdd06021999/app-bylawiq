import { lintBylaw, type LintSeverity } from '@/lib/bylaw-linter';

const LABEL: Record<LintSeverity, string> = { blocker: 'Blocker', warning: 'Warning', info: 'Note' };

/**
 * Advisory checks for the bylaw being edited. The findings are text, with the severity written out, not colour alone.
 * The panel always states that the checks are not legal approval, until counsel and product approve the rules.
 */
export function BylawLintPanel({ body, isAmendment }: { body: string; isAmendment: boolean }) {
  if (body.trim().length === 0) return null;

  const result = lintBylaw(body, { isAmendment });

  return (
    <section aria-labelledby="bylaw-lint-heading" className="bylaw-lint">
      <h3 id="bylaw-lint-heading">Advisory checks</h3>
      <p className="muted">
        These checks are advisory. They are not legal approval, and a lawyer reviews every bylaw. The rules
        (version {result.rulesVersion}) have not yet been reviewed by counsel.
      </p>
      {result.findings.length === 0 ? (
        <p>No checks raised for this text.</p>
      ) : (
        <ul className="bylaw-lint-list">
          {result.findings.map((finding, index) => (
            <li key={`${finding.rule}-${index}`}>
              <strong>{LABEL[finding.severity]}:</strong> {finding.message}
              {finding.matched ? (
                <>
                  {' '}
                  <q>{finding.matched}</q>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
