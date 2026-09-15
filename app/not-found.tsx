import Link from 'next/link';
export default function NotFound(){return <div className="onboarding"><h1>This page is unavailable.</h1><p>Choose a building from your workspace to continue.</p><Link className="button button-primary" href="/workspace">Open workspace</Link></div>;}
