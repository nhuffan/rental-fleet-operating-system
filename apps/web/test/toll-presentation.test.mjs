import test from "node:test";
import assert from "node:assert/strict";
import {
  csvHeaders,
  bulkRecordable,
} from "../src/features/commercial/tolls/policy.ts";
test("CSV column labels support BOM, quoted separators and escaped quotes without reading data rows", () => {
  assert.deepEqual(
    csvHeaders('\uFEFF"Biển,số","Ngày ""giờ""",Tiền\r\ninvalid raw data', ","),
    ["Biển,số", 'Ngày "giờ"', "Tiền"],
  );
  assert.deepEqual(csvHeaders("Biển;Thời điểm;Tiền\n30A;2026;100", ";"), [
    "Biển",
    "Thời điểm",
    "Tiền",
  ]);
  assert.throws(() => csvHeaders('"bad', ","));
  assert.throws(() =>
    csvHeaders(Array.from({ length: 33 }, () => "x").join(","), ","),
  );
});
test("bulk recording only offers explicit confirmed current unique matches without possible expense duplicates", () => {
  const item = {
    status: "MATCHED",
    vehicleId: "vehicle",
    rentalId: "rental",
    suggestion: { vehicleId: "vehicle", rentalId: "rental", ambiguous: false },
    possibleDuplicateMovementIds: [],
  };
  assert.equal(bulkRecordable(item), true);
  assert.equal(
    bulkRecordable({
      ...item,
      rentalId: null,
      suggestion: { ...item.suggestion, rentalId: null },
    }),
    false,
  );
  for (const change of [
    { status: "RECORDED" },
    { status: "NEEDS_REVIEW" },
    { vehicleId: null },
    { possibleDuplicateMovementIds: ["existing"] },
    { suggestion: { ...item.suggestion, ambiguous: true } },
    { suggestion: { ...item.suggestion, vehicleId: "other" } },
    { suggestion: { ...item.suggestion, rentalId: null } },
  ])
    assert.equal(bulkRecordable({ ...item, ...change }), false);
});
