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

test("explicit allowed deep links do not substitute another authorization surface", async () => {
  for (const destination of [
    "/app",
    "/app/rentals?status=ACTIVE",
    "/superadmin/users?page=2",
  ]) {
    assert.equal(
      await resolveLoginDestination(destination, async () => {
        assert.fail(
          "An explicit destination must be checked by its protected layout",
        );
      }),
      destination,
    );
  }
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
