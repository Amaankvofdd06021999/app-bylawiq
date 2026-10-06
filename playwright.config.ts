import { defineConfig, devices } from '@playwright/test';
const port = process.env.E2E_PORT ?? '3000';
// A `next dev` server can't be started twice for this directory, and this machine already runs one on
// another port for local work — so CI, and anyone passing E2E_START=1 locally, serve the production build
// instead (`next start` on E2E_PORT) rather than `next dev`.
const useBuild = Boolean(process.env.CI) || process.env.E2E_START === '1';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:' + port, trace: 'retain-on-failure' }, // CI already runs `npm run build`; serving that build avoids the dev server's on-demand compile, during which
  // tests could click before the page hydrated (a citation dialog that never opened).
  webServer: {
    command: useBuild ? 'npm run start -- --hostname 127.0.0.1 --port ' + port : 'npm run dev',
    url: 'http://127.0.0.1:' + port + '/demo',
    env: { DEMO_MODE: 'on' },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
