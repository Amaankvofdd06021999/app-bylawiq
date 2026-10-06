import Link from 'next/link';
import { Brand } from '@/components/ui';
import { DISCLAIMER } from '@/lib/constants';
export const metadata = { title: 'Invitation' };
// Invitation links made in the demo land here. Nobody is emailed and no account is created.
export default function DemoInvite() {
  return (
    <main className="onboarding" id="main">
      <Brand />
      <h1>Invitations are simulated in the demo.</h1>
      <p>
        In BylawIQ, the person you invite gets this link by email, signs in with that address, and joins the
        building with the role you chose. In the demo nobody is emailed, and the invitation stays listed on
        the building’s Members page until you revoke it.
      </p>
      <div className="action-line" style={{ marginTop: 25 }}>
        <Link className="button button-primary" href="/demo/workspace">
          Back to the demo
        </Link>
        <Link className="button button-secondary" href="/demo">
          Switch person
        </Link>
      </div>
      <p className="disclaimer">{DISCLAIMER}</p>
    </main>
  );
}
