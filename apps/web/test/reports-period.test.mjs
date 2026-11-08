import assert from "node:assert/strict";
import test from "node:test";
import {
  apiRange,
  exportHref,
  isExportKind,
  monthLabel,
  percent,
  reportFilters,
} from "../src/features/reports/period.ts";

const now = new Date("2026-11-08T08:00:00Z");

test("defaults to the last 30 Vietnam days and normalizes bad input", () => {
  assert.deepEqual(reportFilters({}, now), {
    from: "2026-10-10",
    until: "2026-11-08",
  });
  assert.deepEqual(
    reportFilters({ from: "nope", until: "2026-02-31" }, now),
    { from: "2026-10-10", until: "2026-11-08" },
  );
  assert.deepEqual(reportFilters({ from: "2026-11-05", until: "2026-11-01" }, now), {
    from: "2026-11-01",
    until: "2026-11-05",
  });
});

test("treats the end day as inclusive with a Vietnam-midnight exclusive API bound", () => {
  assert.deepEqual(apiRange({ from: "2026-10-01", until: "2026-10-31" }), {
    from: "2026-09-30T17:00:00.000Z",
    until: "2026-10-31T17:00:00.000Z",
  });
});

test("allowlists export kinds and builds same-origin download links", () => {
  assert.ok(isExportKind("movements"));
  assert.ok(!isExportKind("audit"));
  assert.ok(!isExportKind("../vehicles"));
  assert.equal(
    exportHref("rentals", { from: "2026-10-01", until: "2026-10-31" }),
    "/app/reports/export/rentals?from=2026-10-01&until=2026-10-31",
  );
});

test("formats labels", () => {
  assert.equal(monthLabel("2026-10"), "Tháng 10/2026");
  assert.equal(percent(32.3), "32,3%");
});
