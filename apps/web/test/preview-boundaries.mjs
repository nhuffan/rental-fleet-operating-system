import test from "node:test";
import assert from "node:assert/strict";
// Run against a temporary `next start` production server; never target real data.
const base = process.env.UI_TEST_BASE_URL;
if (!base)
  throw new Error("Set UI_TEST_BASE_URL to a localhost production server.");
const parsed = new URL(base);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
  throw new Error("UI release tests are restricted to localhost.");
}
for (const path of [
  "/dev-preview/business",
  "/dev-preview/business/vehicles",
  "/dev-preview/business/trips",
  "/dev-preview/platform",
  "/dev-preview/platform/businesses/minh-an",
]) {
  test(`production excludes design preview: ${path}`, async () => {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.ok(!html.includes("DEMO 001"), "fleet fixture must not be rendered");
    assert.ok(
      !html.includes("Minh An Mobility"),
      "platform fixture must not be rendered",
    );
  });
}
for (const path of [
  "/app",
  "/app/users",
  "/app/audit",
  "/app/commercial",
  "/app/commercial/00000000-0000-4000-8000-000000000001",
  "/app/fleet-map",
  "/app/trips",
  "/app/trips/invalid-trip-id",
  "/app/vehicles",
  "/app/vehicles/devices",
  "/app/customers",
  "/app/customers/00000000-0000-4000-8000-000000000001",
  "/app/rentals",
  "/app/rentals/new",
  "/app/rentals/00000000-0000-4000-8000-000000000001",
  "/app/vehicles/00000000-0000-4000-8000-000000000001",
]) {
  test(`unauthenticated tenant route redirects to login: ${path}`, async () => {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(response.status));
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      "/login",
    );
    assert.match(response.headers.get("cache-control") || "", /private/);
  });
}

for (const path of [
  "/superadmin",
  "/superadmin/businesses",
  "/superadmin/businesses/00000000-0000-4000-8000-000000000001",
  "/superadmin/users",
]) {
  test(`unauthenticated superadmin route redirects to shared login: ${path}`, async () => {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(response.status));
    const target = new URL(response.headers.get("location"), base);
    assert.equal(target.pathname, "/login");
    assert.equal(target.searchParams.get("next"), path);
    assert.match(response.headers.get("cache-control") || "", /private/);
    const body = await response.text();
    assert.ok(
      !body.includes("Minh An Mobility"),
      "platform fixtures must never be used by the private live console",
    );
  });
}
