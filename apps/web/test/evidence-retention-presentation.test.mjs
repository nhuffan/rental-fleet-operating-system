import test from "node:test";
import assert from "node:assert/strict";
import {
  readableMedia,
  protectableMedia,
} from "../src/features/rentals/evidence/retention-presentation.ts";
test("tombstones, in-flight deletion and uncertain retries cannot mount media or expose protection controls", () => {
  for (const retentionStatus of [
    "PURGING",
    "PURGED",
    "RETRY_REQUIRED",
    "UNKNOWN",
  ]) {
    assert.equal(readableMedia({ retentionStatus, canRead: true }), false);
    assert.equal(
      protectableMedia({ retentionStatus, canProtect: true }),
      false,
    );
  }
});
test("remaining active or eligible files require explicit server authorization flags", () => {
  for (const retentionStatus of ["ACTIVE", "PURGE_ELIGIBLE"]) {
    assert.equal(readableMedia({ retentionStatus, canRead: false }), false);
    assert.equal(
      protectableMedia({ retentionStatus, canProtect: false }),
      false,
    );
    assert.equal(
      readableMedia({ retentionStatus, canRead: true }),
      retentionStatus === "ACTIVE",
    );
    assert.equal(protectableMedia({ retentionStatus, canProtect: true }), true);
    assert.equal(readableMedia({ retentionStatus }), false);
  }
});
