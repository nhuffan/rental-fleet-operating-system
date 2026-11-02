import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DOCUMENT_PLACEHOLDER,
  documentDate,
  documentMoney,
  documentText,
  isPrintKind,
  printVersion,
  vndInWords,
  wholeVnd,
} from "../src/features/rentals/documents/presentation.ts";

test("VND words preserve Vietnamese groups and exact whole amounts", () => {
  for (const [amount, words] of [
    ["0", "Không đồng"],
    ["1000", "Một nghìn đồng"],
    ["1001000", "Một triệu không trăm lẻ một nghìn đồng"],
    [
      "999999999",
      "Chín trăm chín mươi chín triệu chín trăm chín mươi chín nghìn chín trăm chín mươi chín đồng",
    ],
    ["105", "Một trăm lẻ năm đồng"],
    ["115", "Một trăm mười lăm đồng"],
    ["121", "Một trăm hai mươi mốt đồng"],
    ["100000001", "Một trăm triệu không trăm lẻ một đồng"],
  ])
    assert.equal(vndInWords(amount), words);
  assert.equal(vndInWords("1000.00"), "Một nghìn đồng");
});
test("money formatting never rounds fractional legacy amounts or uses floating point", () => {
  assert.equal(documentMoney("999999999999999"), "999.999.999.999.999 đồng");
  assert.equal(wholeVnd("1000.00"), 1000n);
  for (const value of [
    "1.01",
    "1e3",
    "-1",
    "NaN",
    "Infinity",
    "0005",
    "1,000",
    0.5,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(wholeVnd(value), null);
    assert.equal(vndInWords(value), "Không hỗ trợ số tiền lẻ");
  }
});
test("document kinds and versions are strict route values", () => {
  for (const kind of ["contract", "handover", "return"])
    assert.equal(isPrintKind(kind), true);
  for (const kind of [
    "Contract",
    "handover/../contract",
    "invoice",
    "",
    "RETURN",
  ])
    assert.equal(isPrintKind(kind), false);
  for (const version of [
    "0",
    "-1",
    "1.5",
    "1e2",
    ["1", "2"],
    undefined,
    "1000000000",
  ])
    assert.equal(printVersion(version), null);
  assert.equal(printVersion("21"), 21);
});
test("missing information leaves dotted handwriting fields and dates use the business timezone", () => {
  assert.equal(documentText("  "), DOCUMENT_PLACEHOLDER);
  assert.equal(documentText(undefined), DOCUMENT_PLACEHOLDER);
  assert.equal(documentText("  Nguyễn Văn A  "), "Nguyễn Văn A");
  const instant = "2026-11-02T18:05:00Z";
  assert.match(documentDate(instant, "Asia/Ho_Chi_Minh"), /01:05.*3\/11\/26/);
  assert.match(documentDate(instant, "UTC"), /18:05.*2\/11\/26/);
  assert.equal(documentDate("not-a-date", "UTC"), DOCUMENT_PLACEHOLDER);
  assert.equal(documentDate(instant, "Not/A_Zone"), DOCUMENT_PLACEHOLDER);
});
test("print documents use A4 flow and hide the application frame only in print", () => {
  const css = readFileSync("src/styles/print-documents.css", "utf8");
  const shell = readFileSync("src/styles/app-shell.css", "utf8");
  assert.match(css, /@page rentalDocument\s*\{\s*size: A4/);
  assert.match(css, /@media print/);
  assert.match(css, /\.no-print\s*\{\s*display: none !important/);
  for (const selector of [
    ".app-sidebar",
    ".topbar",
    ".workspace-footer",
    ".workspace-scroll",
  ])
    assert.ok(shell.includes(`body:has(.print-document) ${selector}`));
  assert.match(shell, /overflow: visible/);
});
test("print pages read saved versions, guard kinds and never issue documents through GET", () => {
  const route = readFileSync(
    "src/app/app/rentals/[id]/print/[kind]/page.tsx",
    "utf8",
  );
  assert.match(route, /!isPrintKind\(kind\)/);
  assert.match(route, /rentalContext\("rental.read"\)/);
  assert.match(route, /\/contract\/\$\{version\}/);
  assert.doesNotMatch(route, /method:\s*["']POST["']/);
  const content = readFileSync(
    "src/features/rentals/documents/print-content.tsx",
    "utf8",
  );
  assert.match(content, /Ảnh\/video lưu trên hệ thống/);
  assert.doesNotMatch(content, /<img|<video|dangerouslySetInnerHTML|signedUrl/);
});
