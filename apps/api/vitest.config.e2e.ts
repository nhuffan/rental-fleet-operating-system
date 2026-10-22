import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Suites share disposable Auth fixtures; avoid racing profile/membership revocation checks.
  test: {
    globals: true,
    // Real Supabase Auth verification is performed on every HTTP request.
    testTimeout: 30000,
    root: './',
    fileParallelism: false,
    include: ['test/**/*.e2e-spec.ts'],
  },
});
