import { Scale } from 'lucide-react';
import { DISCLAIMER } from '@/lib/constants';
/** Non-dismissible notice on every owner drafting tool (spec §5). There is no close button on purpose. */
export function LegalBanner() {
  return (
    <div role="note" aria-label="Legal notice" className="legal-banner">
      <Scale size={18} aria-hidden />
      <div>
        <strong>Drafting help for owners needs legal sign-off before launch — demo only</strong>
        <p>{DISCLAIMER}</p>
      </div>
    </div>
  );
}
