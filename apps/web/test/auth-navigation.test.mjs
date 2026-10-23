import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnPath,
  platformLoginPath,
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
