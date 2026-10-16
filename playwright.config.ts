import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run only against a production build of the app on a dedicated test port, and only against the
 * local Supabase stack. Each guard below fails the run before any browser starts.
 *
 * - The test port defaults to 3100. Port 3000 is refused: that is where a developer's `next dev` may point at hosted data.
 * - An existing server is never reused, so a stray dev server cannot receive test traffic.
 * - A supplied NEXT_PUBLIC_SUPABASE_URL must be the local stack. Without one, the app is started with empty Supabase
 *   variables, so `.env.local` (which may hold hosted values) is never read by the server under test.
 * - With the local stack, the app also runs the local model stub (AI_PROVIDER=local-stub) and the local Inngest dev
 *   server (INNGEST_DEV=1). Both are refused by the app on Vercel and on any non-local database.
 */

const LOCAL_SUPABASE = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/;
const port = process.env.E2E_PORT ?? '3100';
const inngestPort = process.env.E2E_INNGEST_PORT ?? '8288';
const scannerPort = Number(process.env.LOCAL_SCANNER_PORT ?? '8790');
const suppliedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const local = LOCAL_SUPABASE.test(suppliedSupabaseUrl);

if (port === '3000') {
  throw new Error(
    'Refusing to run end-to-end tests on port 3000. Use E2E_PORT (default 3100), a dedicated test port.',
  );
}
if (suppliedSupabaseUrl !== '' && !local) {
  throw new Error(
    'Refusing to run end-to-end tests: NEXT_PUBLIC_SUPABASE_URL is not the local Supabase stack (http://127.0.0.1:54321). ' +
      'End-to-end tests never run against a hosted project.',
  );
}

const appServer = {
  // Always the production build: `npm run build` must run first, with the local environment (scripts/e2e-local.mjs does both).
  command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
  url: `http://127.0.0.1:${port}/login`,
  env: {
    DEMO_MODE: 'on',
    NEXT_PUBLIC_SUPABASE_URL: suppliedSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ?? '',
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    // Added only with the local stack, so no empty value reaches the model or Inngest SDKs otherwise.
    ...(local
      ? {
          AI_PROVIDER: 'local-stub',
          FILE_SCAN_URL: `http://127.0.0.1:${scannerPort}/scan`,
          INNGEST_DEV: '1',
          INNGEST_BASE_URL: `http://127.0.0.1:${inngestPort}`,
        }
      : {}),
  },
  reuseExistingServer: false,
};

// The local scanner runs beside the app, with the same token the app is given.
const scannerServer = {
  command: 'node scripts/local-scanner.mjs',
  url: `http://127.0.0.1:${scannerPort}/health`,
  reuseExistingServer: false,
  env: { LOCAL_SCANNER_PORT: String(scannerPort) },
};

const inngestServer = {
  command: `npx --yes inngest-cli@1.46.0 dev --host 127.0.0.1 --port ${inngestPort} -u http://127.0.0.1:${port}/api/inngest`,
  url: `http://127.0.0.1:${inngestPort}`,
  reuseExistingServer: false,
  timeout: 120_000,
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: local ? [appServer, inngestServer, scannerServer] : [appServer],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
