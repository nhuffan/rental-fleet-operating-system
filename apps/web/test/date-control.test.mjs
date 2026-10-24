import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  dateOnly,
  dateTimeChoice,
  dayString,
  dayWithinBounds,
  parseDay,
} from "../src/components/ui/date-control-utils.ts";

test("calendar rejects impossible dates and preserves leap days", () => {
  assert.equal(parseDay("2025-02-29"), null);
  assert.equal(parseDay("2026-04-31"), null);
  assert.equal(parseDay(""), null);
  assert.equal(dayString(parseDay("2024-02-29")), "2024-02-29");
  assert.equal(dateOnly("2026-10-23T17:30"), "2026-10-23");
});
test("calendar has six complete Monday-first weeks through a year boundary", () => {
  const days = calendarDays(new Date(2027, 0, 15, 12));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(dayString(days[0]), "2026-12-28");
  assert.equal(dayString(days[41]), "2027-02-07");
  assert.equal(new Set(days.map(dayString)).size, 42);
});
test("date constraints permit boundary days without enabling dates outside them", () => {
  assert.equal(
    dayWithinBounds("2026-10-23", "2026-10-23T09:30", "2026-10-24T10:45"),
    true,
  );
  assert.equal(
    dayWithinBounds("2026-10-24", "2026-10-23T09:30", "2026-10-24T10:45"),
    true,
  );
  assert.equal(dayWithinBounds("2026-10-22", "2026-10-23T09:30"), false);
  assert.equal(
    dayWithinBounds("2026-10-25", undefined, "2026-10-24T10:45"),
    false,
  );
});
test("datetime selection clamps time only on a min/max boundary day", () => {
  assert.equal(
    dateTimeChoice("2026-10-23", "08:15", "2026-10-23T09:30"),
    "2026-10-23T09:30",
  );
  assert.equal(
    dateTimeChoice("2026-10-24", "15:00", undefined, "2026-10-24T10:45"),
    "2026-10-24T10:45",
  );
  assert.equal(
    dateTimeChoice("2026-10-24", "08:15", "2026-10-23T09:30"),
    "2026-10-24T08:15",
  );
  assert.equal(
    dateTimeChoice("2026-10-23", "", undefined, undefined),
    "2026-10-23T00:00",
  );
});
