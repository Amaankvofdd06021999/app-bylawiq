'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { resetDemoAction } from '../actions';
// Non-dismissible (spec §3.7). The shell's sidebar is fixed to the viewport, so it is pushed below the banner here
// rather than in globals.css — the real app never renders this component.
export function DemoBanner() {
  const router = useRouter();
  const [pending, start] = useTransition(),
    [error, setError] = useState('');
  // The near-white text/surface here reuses --background (the app's light token) instead of a hard-coded #fff.
  return (
    <div role="region" aria-label="Demo" className="demo-banner">
      <style>
        {
          '.demo-banner{position:sticky;top:0;z-index:60;min-height:44px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 16px;padding:6px 16px;background:var(--ai);color:var(--background);font-size:12px}.demo-banner a{color:var(--background);text-decoration:underline;text-underline-offset:3px}.demo-banner a:focus-visible,.demo-banner button:focus-visible{outline:2px solid var(--background);outline-offset:2px}.demo-banner .button{background:var(--background);color:var(--ai)}.sidebar{top:44px}'
        }
      </style>
      <p style={{ margin: 0 }}>Demo — sample data. Changes reset when you choose Reset demo.</p>
      <Button
        variant="secondary"
        size="small"
        busy={pending}
        onClick={() =>
          start(async () => {
            setError('');
            try {
              await resetDemoAction();
              router.refresh();
            } catch {
              setError('The demo could not be reset. Refresh and try again.');
            }
          })
        }
      >
        Reset demo
      </Button>
      <Link href="/demo">Switch person</Link>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
