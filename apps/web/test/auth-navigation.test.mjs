import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnPath,
  platformLoginPath,
  resolveLoginDestination,
} from "../src/lib/auth-navigation.ts";
for (const [index, value] of [
  undefined,
  null,
  ["/superadmin"],
  "https://evil.invalid/app",
  "//evil.invalid/superadmin",
  "/\\evil.invalid",
  "/app/../../login",
  "/superadmin/../login",
  "/application",
  "/portalx",
  "/portal/../login",
  "/superadministrator",
  "/login?next=/superadmin",
  "/app\nredirect",
  "/" + "a".repeat(2048),
].entries()) {
  test(`reject unsafe login return #${index}`, () =>
    assert.equal(safeReturnPath(value), "/app"));
}
for (const value of [
  "/app",
  "/app/vehicles/00000000-0000-4000-8000-000000000001",
  "/superadmin",
  "/superadmin/businesses?page=2&search=test",
  "/portal",
  "/portal/rentals/00000000-0000-4000-8000-000000000001",
]) {
  test(`preserve allowed login return ${value}`, () =>
    assert.equal(safeReturnPath(value), value));
}
test("platform login retains a local filtered return path", () => {
  const path = "/superadmin/businesses?status=ACTIVE&page=2";
  const target = new URL(platformLoginPath(path), "https://rental.invalid");
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("next"), path);
  assert.equal(
    new URL(
      platformLoginPath("//evil.invalid"),
      "https://rental.invalid",
    ).searchParams.get("next"),
    "/superadmin",
  );
});

test("allowed deep links are preserved only after verifying their independent grant", async () => {
  for (const destination of [
    "/app",
    "/app/rentals?status=ACTIVE",
    "/superadmin/users?page=2",
    "/superadmin?view=overview",
  ]) {
    const probes = [];
    assert.equal(
      await resolveLoginDestination(destination, async (path) => {
        probes.push(path);
        return 200;
      }),
      destination,
    );
    assert.deepEqual(probes, [
      destination.startsWith("/superadmin") ? "/platform/me" : "/me",
    ]);
  }
});
test("a role-specific stale login hint automatically lands in the granted workspace", async () => {
  assert.equal(
    await resolveLoginDestination("/superadmin?view=overview", async (path) =>
      path === "/me" ? 200 : 403,
    ),
    "/app",
  );
  assert.equal(
    await resolveLoginDestination("/app/rentals", async (path) =>
      path === "/platform/me" ? 200 : 403,
    ),
    "/superadmin",
  );
});

test("generic Owner login uses the verified tenant grant", async () => {
  const probes = [];
  const destination = await resolveLoginDestination(null, async (path) => {
    probes.push(path);
    return 200;
  });
  assert.equal(destination, "/app");
  assert.deepEqual(probes, ["/me"]);
});

test("generic Superadmin login uses the independent platform grant after tenant denial", async () => {
  const probes = [];
  const destination = await resolveLoginDestination(undefined, async (path) => {
    probes.push(path);
    return path === "/me" ? 403 : 200;
  });
  assert.equal(destination, "/superadmin");
  assert.deepEqual(probes, ["/me", "/platform/me"]);
});

test("accounts without either grant receive no administration landing page", async () => {
  assert.equal(
    await resolveLoginDestination(null, async () => 403),
    "/access-denied",
  );
});

test("hostile return URLs are ignored before choosing a verified local landing", async () => {
  for (const next of [
    "//evil.invalid",
    "https://evil.invalid/app",
    "/app/../../login",
    ["/superadmin"],
  ]) {
    assert.equal(await resolveLoginDestination(next, async () => 200), "/app");
  }
});

test("unexpected tenant failures do not fall back to platform access", async () => {
  for (const status of [401, 429, 500]) {
    const probes = [];
    await assert.rejects(
      resolveLoginDestination(null, async (path) => {
        probes.push(path);
        return status;
      }),
    );
    assert.deepEqual(probes, ["/me"]);
  }
});

test("unexpected platform failures and network errors fail closed", async () => {
  for (const status of [401, 429, 500]) {
    await assert.rejects(
      resolveLoginDestination(null, async (path) =>
        path === "/me" ? 403 : status,
      ),
    );
  }
  await assert.rejects(
    resolveLoginDestination(null, async () => {
      throw new Error("Network unavailable");
    }),
  );
});

test("a Customer lands in the portal only after Owner and platform grants are denied", async () => {
  const probes = [];
  assert.equal(
    await resolveLoginDestination(null, async (path) => {
      probes.push(path);
      return path === "/portal/me" ? 200 : 403;
    }),
    "/portal",
  );
  assert.deepEqual(probes, ["/me", "/platform/me", "/portal/me"]);
});

test("a portal deep link is preserved only for a verified Customer grant", async () => {
  const link = "/portal/rentals/00000000-0000-4000-8000-000000000001";
  const probes = [];
  assert.equal(
    await resolveLoginDestination(link, async (path) => {
      probes.push(path);
      return 200;
    }),
    link,
  );
  assert.deepEqual(probes, ["/portal/me"]);
  assert.equal(
    await resolveLoginDestination(link, async (path) =>
      path === "/me" ? 200 : 403,
    ),
    "/app",
  );
});

test("an unexpected Customer probe failure fails closed", async () => {
  await assert.rejects(
    resolveLoginDestination(null, async (path) => (path === "/portal/me" ? 500 : 403)),
  );
});
