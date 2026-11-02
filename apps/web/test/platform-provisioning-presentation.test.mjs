import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canPlatformAction, canIssueOwnerLink, ownerAccessUnavailable } from "../src/features/platform/live/provisioning-policy.ts";

test("platform write controls require their independent permission, not an Owner label", () => {
  const writes = ["platform.business.create", "platform.business.manage", "platform.owner.access"];
  for (const permission of writes) {
    assert.equal(canPlatformAction(["business.update", "user.manage", "OWNER"], permission), false);
    assert.equal(canPlatformAction(["platform.business.read"], permission), false);
    assert.equal(canPlatformAction([permission], permission), true);
  }
});
test("recovery controls require the business, Owner membership and profile to be active", () => {
  const active = {status:"ACTIVE", profileStatus:"ACTIVE"};
  assert.equal(canIssueOwnerLink("ACTIVE",active), true);
  assert.equal(ownerAccessUnavailable("ACTIVE",active), "");
  for (const [businessStatus, owner] of [
    ["DISABLED",active],
    ["ACTIVE",{...active,status:"DISABLED"}],
    ["ACTIVE",{...active,profileStatus:"DISABLED"}],
  ]) {
    assert.equal(canIssueOwnerLink(businessStatus,owner), false);
    assert.notEqual(ownerAccessUnavailable(businessStatus,owner), "");
  }
});
test("provisioning credentials stay transient and platform mutations never select a tenant", () => {
  const files = ["create-business.tsx", "business-access.tsx", "owner-access-link.tsx"];
  const sources = files.map(name=>readFileSync(new URL("../src/features/platform/live/"+name,import.meta.url),"utf8"));
  for (const source of sources) {
    assert.doesNotMatch(source,/localStorage|sessionStorage|console\.|window\.location|router\.(?:push|replace)\(/);
    assert.doesNotMatch(source,/<a[^>]+href=[{]accessUrl/);
  }
  assert.match(sources[0],/setAccessUrl\(null\)/);
  assert.match(sources[1],/setAccessUrl\(null\)/);
  assert.match(sources[2],/navigator\.clipboard\.writeText\(accessUrl\)/);
  const client = readFileSync(new URL("../src/lib/api-client/use-platform-mutation.ts",import.meta.url),"utf8");
  assert.doesNotMatch(client,/X-Business-Id|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(client,/cache: "no-store"/);
});
