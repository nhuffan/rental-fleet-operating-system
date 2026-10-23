import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Run real Auth/database suites serially to bound load; each owns isolated disposable fixtures.
  test: {
    globals: true,
    // Real Supabase Auth verification is performed on every HTTP request.
    testTimeout: 30000,
    root: './',
    fileParallelism: false,
    include: ['test/**/*.e2e-spec.ts'],
  },
});
