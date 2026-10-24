import test from "node:test";
import assert from "node:assert/strict";
import {
  fittedSize,
  videoEncoder,
  originalVideoAllowed,
  mediaLimits,
} from "../src/features/rentals/evidence/media-policy.ts";
test("image/video fit preserves aspect ratio without upscaling or exceeding encoding bounds", () => {
  assert.deepEqual(fittedSize(4000, 3000, 1920), { width: 1920, height: 1440 });
  assert.deepEqual(fittedSize(300, 200, 1920), { width: 300, height: 200 });
  assert.deepEqual(fittedSize(1080, 1920, 1280, 720), {
    width: 405,
    height: 720,
  });
});
test("native encoder chooses supported MP4 first and exposes WebM/unsupported fallbacks", () => {
  assert.equal(
    videoEncoder((mime) => mime === "video/mp4" || mime === "video/webm"),
    "video/mp4",
  );
  assert.equal(
    videoEncoder((mime) => mime === "video/webm"),
    "video/webm",
  );
  assert.equal(
    videoEncoder(() => false),
    null,
  );
});
test("original fallback never accepts oversized, overlong, unknown MIME or excessive resolution video", () => {
  assert.equal(
    originalVideoAllowed(
      mediaLimits.maxVideoBytes,
      30,
      1080,
      1920,
      "video/mp4",
    ),
    true,
  );
  for (const values of [
    [mediaLimits.maxVideoBytes + 1, 30, 1280, 720, "video/mp4"],
    [1000, 30.1, 1280, 720, "video/mp4"],
    [1000, Infinity, 1280, 720, "video/mp4"],
    [1000, 2, 1280, 720, "video/quicktime"],
    [1000, 2, 3840, 2160, "video/mp4"],
    [0, 2, 1280, 720, "video/mp4"],
  ])
    assert.equal(originalVideoAllowed(...values), false);
});
