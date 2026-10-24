import test from "node:test";
import assert from "node:assert/strict";
import { transferMedia } from "../src/features/rentals/evidence/transfer-media.ts";
function harness(overrides = {}) {
  const events = [];
  const authorization = {
    id: "upload-1",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  const input = {
    signal: new AbortController().signal,
    authorize: async () => {
      events.push("authorize");
      return authorization;
    },
    verify: async () => {
      events.push("verify");
      return { status: "VERIFIED" };
    },
    upload: async () => {
      events.push("upload");
    },
    onAuthorized: () => events.push("saved"),
    onStage: (stage) => events.push(stage),
    ...overrides,
  };
  return { input, events, authorization };
}
test("retry verifies a stored file before requesting another upload capability", async () => {
  const h = harness();
  await transferMedia({ ...h.input, authorization: h.authorization });
  assert.deepEqual(h.events, ["verifying", "verify"]);
});
test("a lost upload response is recovered by verification without repeating the binary transfer", async () => {
  const h = harness({
    upload: async () => {
      throw new TypeError("connection lost");
    },
  });
  await transferMedia(h.input);
  assert.deepEqual(h.events, [
    "authorize",
    "saved",
    "uploading",
    "verifying",
    "verify",
  ]);
});
test("only a confirmed missing object permits reupload; rejection and permission errors remain visible", async () => {
  const h = harness();
  let calls = 0;
  await transferMedia({
    ...h.input,
    authorization: h.authorization,
    verify: async () => {
      if (++calls === 1)
        throw Object.assign(new Error("not uploaded"), {
          code: "EVIDENCE_NOT_READY",
        });
      return { status: "VERIFIED" };
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(h.events, [
    "verifying",
    "authorize",
    "saved",
    "uploading",
    "upload",
    "verifying",
  ]);
  for (const code of [
    "EVIDENCE_INVALID_FILE",
    "PERMISSION_DENIED",
    "EVIDENCE_VERIFYING",
  ]) {
    const error = Object.assign(new Error(code), { code });
    const blocked = harness({
      verify: async () => {
        throw error;
      },
    });
    await assert.rejects(
      transferMedia({ ...blocked.input, authorization: blocked.authorization }),
      (value) => value === error,
    );
    assert.deepEqual(blocked.events, ["verifying"]);
  }
});
test("cancel during transfer prevents verification and attachment readiness", async () => {
  const controller = new AbortController();
  const h = harness({
    signal: controller.signal,
    upload: async () => controller.abort(),
  });
  await assert.rejects(transferMedia(h.input), { name: "AbortError" });
  assert.deepEqual(h.events, ["authorize", "saved", "uploading"]);
});
