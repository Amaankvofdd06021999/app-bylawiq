import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Brand } from '@/components/ui';
import { PERSONAS } from '@/mock/personas';
import { DISCLAIMER } from '@/lib/constants';
export const metadata = { title: 'Demo' };
export default function DemoPicker() {
  return (
    <main className="onboarding" id="main">
      <Brand />
      <span className="eyebrow" style={{ marginTop: 45 }}>
        Interactive demo
      </span>
      <h1>Choose a person to try BylawIQ as.</h1>
      <p className="form-note">
        Five people, five roles: the BylawIQ platform, a strata management firm’s owner and one of its
        managers, a building manager, and a resident. Each starts on their own home and sees only what their
        role allows, using sample buildings and documents. Nothing here touches real data, and answers come
        only from the sample documents. Switching person keeps whatever you’ve changed so far — choose Reset
        demo to start over.
      </p>
      <div
        className="card-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', marginTop: 25 }}
      >
        {PERSONAS.map((p) => (
          <Link key={p.id} href={'/demo/start/' + p.id} prefetch={false} className="card agent-card">
            <div className="agent-card-top">
              <div>
                <span className="eyebrow">{p.title}</span>
                <h3>{p.name}</h3>
              </div>
              <ArrowUpRight size={17} aria-hidden />
            </div>
            <p>{p.description}</p>
            <div className="agent-card-footer">
              <span className="form-note">Start as {p.name.split(' ')[0]}</span>
            </div>
          </Link>
        ))}
      </div>
      <p className="disclaimer">{DISCLAIMER}</p>
    </main>
  );
}
