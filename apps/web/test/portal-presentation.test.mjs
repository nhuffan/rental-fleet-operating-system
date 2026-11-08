import assert from "node:assert/strict";
import test from "node:test";
import {
  portalMoney,
  portalStatusLabels,
  portalVersion,
} from "../src/features/portal/presentation.ts";

test("formats exact VND strings without Number conversion", () => {
  assert.equal(portalMoney("1500000", "VND"), "1.500.000 ₫");
  assert.equal(portalMoney("999999999999999", "VND"), "999.999.999.999.999 ₫");
  assert.equal(portalMoney("1500000.50", "VND"), "1.500.000,5 ₫");
  assert.equal(portalMoney("12.00", "USD"), "12.00 USD");
  assert.equal(portalMoney("-1", "VND"), "Không khả dụng");
  assert.equal(portalMoney("abc", "VND"), "Không khả dụng");
});

test("accepts only bounded positive contract versions", () => {
  assert.equal(portalVersion("1"), 1);
  assert.equal(portalVersion("2147483647"), 2147483647);
  for (const value of ["0", "01", "-1", "1.5", "2147483648", "abc", ""])
    assert.equal(portalVersion(value), null);
});

test("never exposes draft status to customers", () => {
  assert.ok(!("DRAFT" in portalStatusLabels));
});
