import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { themeInitScript } from "../src/lib/theme-init.ts";

function firstTheme(saved, systemDark, storageBlocked = false) {
  const document = { documentElement: { dataset: {} } };
  runInNewContext(themeInitScript, {
    document,
    window: { matchMedia: () => ({ matches: systemDark }) },
    localStorage: {
      getItem: () => {
        if (storageBlocked) throw new Error("blocked");
        return saved;
      },
    },
  });
  return document.documentElement.dataset.theme;
}

test("saved local theme wins before content rendering", () => {
  assert.equal(firstTheme("dark", false), "dark");
  assert.equal(firstTheme("light", true), "light");
});
test("missing or invalid preferences use system color scheme", () => {
  for (const saved of [null, "invalid", "<script>"]) {
    assert.equal(firstTheme(saved, true), "dark");
    assert.equal(firstTheme(saved, false), "light");
  }
});
test("blocked browser storage still initializes a usable system theme", () => {
  assert.equal(firstTheme(null, true, true), "dark");
  assert.equal(firstTheme(null, false, true), "light");
});
