import assert from "node:assert/strict";
import test from "node:test";
import {
  complianceState,
  complianceText,
  formatDay,
  vietnamToday,
} from "../src/features/fleet/vehicles/compliance.ts";

test("uses the Vietnam calendar day around UTC midnight", () => {
  assert.equal(vietnamToday(new Date("2026-11-08T16:59:00Z")), "2026-11-08");
  assert.equal(vietnamToday(new Date("2026-11-08T17:00:00Z")), "2026-11-09");
});

test("classifies due dates with the API 30-day rule", () => {
  const today = "2026-11-08";
  assert.deepEqual(complianceState(null, today), { state: "NONE", days: null });
  assert.deepEqual(complianceState("2026-11-07", today), { state: "OVERDUE", days: -1 });
  assert.deepEqual(complianceState("2026-11-08", today), { state: "DUE_SOON", days: 0 });
  assert.deepEqual(complianceState("2026-12-08", today), { state: "DUE_SOON", days: 30 });
  assert.deepEqual(complianceState("2026-12-09", today), { state: "OK", days: 31 });
});

test("formats text and dates without timezone drift", () => {
  assert.equal(complianceText("OVERDUE", -3), "Đã quá hạn 3 ngày");
  assert.equal(complianceText("DUE_SOON", 0), "Hết hạn hôm nay");
  assert.equal(complianceText("OK", 45), "Còn 45 ngày");
  assert.equal(complianceText("NONE", null), "Chưa khai báo");
  assert.equal(formatDay("2027-03-31"), "31/03/2027");
});
