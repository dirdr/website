import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'production', use: { baseURL: 'http://127.0.0.1:4317' } },
    { name: 'development', use: { baseURL: 'http://127.0.0.1:4319' } },
  ],
  webServer: [
    {
      command: 'python3 -m http.server 4317 --bind 127.0.0.1 --directory dist',
      url: 'http://127.0.0.1:4317',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4319 --ignore-lock',
      url: 'http://127.0.0.1:4319',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
