import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:8082',
    browserName: 'chromium',
    timezoneId: 'America/New_York',
    screenshot: 'only-on-failure',
    trace: 'off', // Do not capture authentication request/response bodies.
  },
  webServer: {
    command: 'bun run dev:local --browser-test',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: false, // Never silently test an unrelated/prod-configured app.
    timeout: 120_000,
  },
});
