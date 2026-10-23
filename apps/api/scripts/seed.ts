// Personal development identities must never be recreated or reset by demo seed.
// Real E2E owns run-scoped disposable fixtures and cleans their exact identities.
console.error(
  'Persistent demo seeding is retired. Use the disposable E2E fixture lifecycle for tests; provision named accounts through a trusted administrator. No account or business data was changed.',
);
process.exitCode = 1;
