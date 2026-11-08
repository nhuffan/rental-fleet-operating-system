import { runSmoke, smokeOptions } from '../src/ops/smoke.js';

// Usage: pnpm smoke --api=https://api.example.com --web=https://app.example.com [--production]
async function main() {
  const checks = await runSmoke(smokeOptions(process.argv.slice(2)));
  for (const c of checks)
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`${checks.length - failed}/${checks.length} checks passed`);
  if (failed) process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Smoke test failed');
  process.exitCode = 1;
});
