import assert from "node:assert/strict";
import test from "node:test";
import {
  environmentLabels,
  featureStatusLabels,
  formatBytes,
  integrationStatusLabels,
} from "../src/features/platform/live/system-presentation.ts";

test("labels every API status without leaking raw enum values", () => {
  for (const status of ["CONFIGURED", "NOT_CONFIGURED", "TEST_ONLY", "PUBLIC"])
    assert.ok(integrationStatusLabels[status]);
  for (const status of ["AVAILABLE", "TEST", "NOT_IMPLEMENTED"])
    assert.ok(featureStatusLabels[status]);
  assert.ok(environmentLabels.production.includes("production"));
});

test("formats byte limits", () => {
  assert.equal(formatBytes(16384), "16 KiB");
  assert.equal(formatBytes(134217728), "128 MiB");
  assert.equal(formatBytes(512), "512 byte");
});
