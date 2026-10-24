import test from "node:test";
import assert from "node:assert/strict";
import {
  operationalDayStart,
  scheduleWindow,
  intervalPosition,
} from "../src/features/dashboard/schedule.ts";

const day = 86400000;
const timestamp = (value) => new Date(value).getTime();

test("calendar boundaries use Vietnam midnight rather than the host timezone", () => {
  const nearMidnight = timestamp("2026-10-23T18:30:00Z");
  assert.equal(
    operationalDayStart(nearMidnight),
    timestamp("2026-10-24T00:00:00+07:00"),
  );
  assert.deepEqual(scheduleWindow(nearMidnight, "day"), {
    start: timestamp("2026-10-24T00:00:00+07:00"),
    end: timestamp("2026-10-25T00:00:00+07:00"),
    duration: day,
  });
});

test("seven-day navigation follows the actual paginated rental anchor", () => {
  const anchor = timestamp("2027-01-31T15:00:00+07:00");
  const current = scheduleWindow(anchor, "week");
  const next = scheduleWindow(anchor, "week", 1);
  assert.equal(current.start, timestamp("2027-01-31T00:00:00+07:00"));
  assert.equal(next.start, current.end);
  assert.equal(next.end - next.start, 7 * day);
});

test("overnight bookings are clipped to each actual day without extending duration", () => {
  const start = "2026-10-23T18:00:00+07:00";
  const end = "2026-10-24T06:00:00+07:00";
  assert.deepEqual(
    intervalPosition(start, end, scheduleWindow(timestamp(start), "day")),
    {
      left: 75,
      width: 25,
    },
  );
  assert.deepEqual(
    intervalPosition(start, end, scheduleWindow(timestamp(end), "day")),
    {
      left: 0,
      width: 25,
    },
  );
});

test("half-open intervals outside the current window never render an availability claim", () => {
  const window = scheduleWindow(timestamp("2026-10-24T12:00:00+07:00"), "day");
  for (const [start, end] of [
    ["2026-10-23T18:00:00+07:00", "2026-10-24T00:00:00+07:00"],
    ["2026-10-25T00:00:00+07:00", "2026-10-25T06:00:00+07:00"],
    ["2026-10-24T12:00:00+07:00", "2026-10-24T12:00:00+07:00"],
  ])
    assert.equal(intervalPosition(start, end, window), null);
});

test("a booking spanning the full visible window stays within zero and one hundred percent", () => {
  const window = scheduleWindow(timestamp("2026-10-24T12:00:00+07:00"), "week");
  assert.deepEqual(
    intervalPosition(
      "2026-10-01T00:00:00+07:00",
      "2026-11-01T00:00:00+07:00",
      window,
    ),
    {
      left: 0,
      width: 100,
    },
  );
});
