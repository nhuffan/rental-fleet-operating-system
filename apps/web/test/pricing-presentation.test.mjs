import test from "node:test";
import assert from "node:assert/strict";
import {
  currentQuoteSnapshot,
  quoteRequestKey,
  settleQuoteRequest,
  validVnd,
  formatVnd,
} from "../src/features/rentals/pricing/policy.ts";
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("a completed older quote cannot overwrite a newer vehicle or schedule and aborted errors stay silent", async () => {
  const oldController = new AbortController();
  const currentController = new AbortController();
  const old = deferred();
  const current = deferred();
  const shown = [];
  const errors = [];
  const oldTask = settleQuoteRequest(
    oldController.signal,
    () => old.promise,
    (value) => shown.push(value),
    (error) => errors.push(error),
  );
  oldController.abort();
  const currentTask = settleQuoteRequest(
    currentController.signal,
    () => current.promise,
    (value) => shown.push(value),
    (error) => errors.push(error),
  );
  current.resolve("current vehicle quotation");
  await currentTask;
  old.resolve("outdated quotation");
  await oldTask;
  assert.deepEqual(shown, ["current vehicle quotation"]);
  assert.deepEqual(errors, []);
  const failed = deferred();
  const controller = new AbortController();
  const failedTask = settleQuoteRequest(
    controller.signal,
    () => failed.promise,
    () => assert.fail("stale success"),
    (error) => errors.push(error),
  );
  controller.abort();
  failed.reject(new Error("old request failed"));
  await failedTask;
  assert.deepEqual(errors, []);
});
test("quote identity isolates tenant, vehicle, schedule, billing mode and retries before displaying a result", () => {
  const input = {
    businessId: "one",
    vehicleId: "vehicle",
    startAt: "2026-10-25T08:00:00Z",
    endAt: "2026-10-26T08:00:00Z",
  };
  const key = quoteRequestKey(input);
  const snapshot = { key: `${key}:0`, quote: { totalAmount: "100000" } };
  assert.equal(currentQuoteSnapshot(snapshot, `${key}:0`), snapshot);
  for (const changed of [
    { businessId: "two" },
    { vehicleId: "other" },
    { startAt: "2026-10-25T09:00:00Z" },
    { endAt: "2026-10-27T08:00:00Z" },
    { billingMode: "HOURLY" },
  ])
    assert.equal(
      currentQuoteSnapshot(
        snapshot,
        `${quoteRequestKey({ ...input, ...changed })}:0`,
      ),
      null,
    );
  assert.equal(currentQuoteSnapshot(snapshot, `${key}:1`), null);
});
test("manual VND agreements reject fractions and out-of-range amounts without rounding", () => {
  for (const value of ["0", "1", "999999999"])
    assert.equal(validVnd(value), true);
  for (const value of ["", "01", "1.5", "-1", "1000000000", "1e3", " 10"])
    assert.equal(validVnd(value), false);
  assert.equal(formatVnd("999999999"), "999.999.999 ₫");
});
