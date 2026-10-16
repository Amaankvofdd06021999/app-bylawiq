import { Inngest } from 'inngest';

// INNGEST_DEV=1 points the SDK at the local Inngest dev server. It is refused on Vercel, so production always uses the
// Inngest cloud and its keys.
const localDev = process.env.INNGEST_DEV === '1';
if (localDev && process.env.VERCEL_ENV) throw new Error('INNGEST_DEV is refused on Vercel.');

export const inngest = new Inngest({
  id: 'bylawiq',
  isDev: localDev || process.env.NODE_ENV !== 'production',
});
