import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',fullyParallel:true,use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure'},// CI already runs `npm run build`; serving that build avoids the dev server's on-demand compile, during which
 // tests could click before the page hydrated (a citation dialog that never opened).
 webServer:{command:process.env.CI?'npm run start -- --hostname 127.0.0.1':'npm run dev',url:'http://127.0.0.1:3000/preview/ask',reuseExistingServer:!process.env.CI},projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
