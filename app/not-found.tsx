'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// One 404 page serves both the real app and the demo, so the way back stays on the side the person came from.
export default function NotFound() {
  const demo = usePathname()?.startsWith('/demo') ?? false;
  return (
    <div className="onboarding">
      <h1>This page is unavailable.</h1>
      <p>Choose a building from your workspace to continue.</p>
      <Link className="button button-primary" href={demo ? '/demo/workspace' : '/workspace'}>
        Open workspace
      </Link>
    </div>
  );
}
