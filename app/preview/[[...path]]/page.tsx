import { redirect } from 'next/navigation';
import { demoEnabled } from '@/lib/env';
// The read-only sample moved to the interactive demo, which is a 404 whenever DEMO_MODE isn't 'on' (AGENTS.md).
// Send visitors to /login instead of into that 404 when the demo is off.
export default function Preview() {
  redirect(demoEnabled() ? '/demo' : '/login');
}
