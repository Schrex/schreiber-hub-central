import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Claude Code cloud sessions preinstall a Chromium that may not match this Playwright version.
// PLAYWRIGHT_CHROMIUM_PATH overrides; otherwise use the cloud copy when it exists. Local machines
// keep Playwright's own browser.
const cloudChromium = '/opt/pw-browsers/chromium';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || (process.env.CLAUDE_CODE_REMOTE === 'true' && existsSync(cloudChromium) ? cloudChromium : undefined);

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
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'bun run dev:local --browser-test',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: false, // Never silently test an unrelated/prod-configured app.
    timeout: 120_000,
  },
});
