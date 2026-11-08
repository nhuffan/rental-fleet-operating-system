import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  contactAction,
  faq,
  features,
  navLinks,
  roles,
} from "../src/features/landing/content.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const landing = read("../src/features/landing/landing-page.tsx");
const css = read("../src/styles/landing.css");

test("every navigation anchor points at a section that exists", () => {
  for (const { href } of navLinks)
    assert.ok(landing.includes(`id="${href.slice(1)}"`), href);
  assert.ok(landing.includes('id="lien-he"'));
  assert.equal(new Set(navLinks.map((l) => l.href)).size, navLinks.length);
});

test("contact action uses mailto only for a valid configured address", () => {
  assert.deepEqual(contactAction("sales@example.com"), {
    href: "mailto:sales@example.com",
    label: "Liên hệ dùng thử",
  });
  for (const value of [undefined, "", "  ", "not-an-email", "a@b", "x y@z.co"])
    assert.deepEqual(contactAction(value), { href: "/login", label: "Đăng nhập" });
});

test("marketing claims stay honest about GPS, customers and roles", () => {
  const text = JSON.stringify({ features, roles, faq });
  assert.match(text, /thử nghiệm/);
  assert.match(text, /chỉ xem và in hợp đồng/i);
  assert.ok(!/thanh toán trực tuyến|online|VNPay|Momo|Stripe/i.test(text));
  assert.equal(roles.filter((r) => r.highlight).length, 1);
});

test("landing styles are scoped and prefixed so they cannot leak into the application", () => {
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((rule) => rule.split("{")[0].trim())
    .filter((s) => s && !s.startsWith("@media"));
  assert.ok(selectors.length > 40);
  for (const selector of selectors)
    for (const part of selector.split(","))
      assert.ok(
        /^(\.landing\b|html:has\(\.landing\))/.test(part.trim()),
        `unscoped selector: ${part.trim()}`,
      );
  assert.ok(!/\.(?!landing\b|lp-|brand-)[a-z]/.test(
    selectors.join(",").replace(/\[[^\]]*\]/g, ""),
  ));
});

test("carBase identity replaces the old raster logo and name", () => {
  const brand = read("../src/components/ui/brand-lockup.tsx");
  assert.match(brand, /aria-label="carBase"/);
  assert.match(brand, /<mask/);
  assert.ok(!brand.includes("mark.png"));
  assert.ok(existsSync(new URL("../src/app/icon.svg", import.meta.url)));
  assert.ok(!existsSync(new URL("../src/app/icon.png", import.meta.url)));
  assert.ok(!existsSync(new URL("../public/brand/mark.png", import.meta.url)));
  assert.match(read("../src/app/layout.tsx"), /carBase/);
  assert.ok(!/Rental Fleet OS/.test(read("../src/app/layout.tsx")));
  const tone = read("../src/styles/brand.css");
  assert.match(tone, /data-tone="light"/);
  assert.match(tone, /data-theme="dark"\] \.brand-lockup\[data-tone="auto"\]/);
});
