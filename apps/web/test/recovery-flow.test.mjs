import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  recoveryParameters,
  passwordValidation,
  MIN_PASSWORD_LENGTH,
} from "../src/lib/recovery-navigation.ts";
import {
  createRecoveryProof,
  validRecoveryProof,
  RECOVERY_WINDOW_SECONDS,
} from "../src/lib/recovery-proof.ts";
import nextConfig from "../next.config.ts";
const uid = "00000000-0000-4000-8000-000000000001";
const business = "00000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);

test("only one bounded recovery hash is accepted and redirect parameters cannot choose a destination", () => {
  for (const query of [
    "",
    `type=invite&token_hash=${token}`,
    `type=email&token_hash=${token}`,
    `type=recovery&type=signup&token_hash=${token}`,
    "type=recovery&token_hash=short",
    `type=recovery&token_hash=${token}&token_hash=${token}`,
    "type=recovery&token_hash=%0a",
  ])
    assert.equal(recoveryParameters(new URLSearchParams(query)), null);
  assert.deepEqual(
    recoveryParameters(
      new URLSearchParams({
        type: "recovery",
        token_hash: token,
        business,
        next: "https://evil.invalid",
        redirect_to: "//evil.invalid",
      }),
    ),
    { tokenHash: token, businessId: business },
  );
  assert.equal(
    recoveryParameters(
      new URLSearchParams({
        type: "recovery",
        token_hash: token,
        business: "//evil.invalid",
      }),
    ).businessId,
    null,
  );
  assert.equal(
    recoveryParameters(
      new URLSearchParams(
        `type=recovery&token_hash=${token}&business=${business}&business=${business}`,
      ),
    ).businessId,
    null,
  );
});
test("recovery flow proof is bound to the verified identity, current token and a short expiration", () => {
  const now = 1793610000000;
  const proof = createRecoveryProof(uid, "session-secret", now);
  assert.equal(proof.includes("session-secret"), false);
  assert.equal(validRecoveryProof(proof, uid, "session-secret", now), true);
  assert.equal(
    validRecoveryProof(
      proof,
      uid,
      "session-secret",
      now + RECOVERY_WINDOW_SECONDS * 1000,
    ),
    false,
  );
  assert.equal(
    validRecoveryProof(proof, business, "session-secret", now),
    false,
  );
  assert.equal(validRecoveryProof(proof, uid, "different-session", now), false);
  assert.equal(
    validRecoveryProof(
      proof.replace(uid, business),
      business,
      "session-secret",
      now,
    ),
    false,
  );
  for (const invalid of [
    undefined,
    "",
    proof + ".extra",
    proof.slice(0, -1),
    "x".repeat(161),
  ])
    assert.equal(
      validRecoveryProof(invalid, uid, "session-secret", now),
      false,
    );
});
test("password policy matches configured minimum and confirmation, without returning password contents", () => {
  const config = readFileSync(
    new URL("../../../supabase/config.toml", import.meta.url),
    "utf8",
  );
  const min = Number(config.match(/^minimum_password_length = (\d+)$/m)[1]);
  assert.equal(MIN_PASSWORD_LENGTH, min);
  assert.ok(passwordValidation("a".repeat(min - 1), "a".repeat(min - 1)));
  assert.equal(passwordValidation("a".repeat(min), "a".repeat(min)), "");
  assert.ok(passwordValidation("strong-example", "other-example"));
  assert.ok(passwordValidation("a".repeat(129), "a".repeat(129)));
  assert.ok(passwordValidation(null, null));
  assert.equal(
    (config.match(/^enable_signup = false$/gm) ?? []).length >= 2,
    true,
  );
});
test("credential routes cannot log query/action arguments and remain fixed no-store redirects", () => {
  assert.equal(nextConfig.logging.serverFunctions, false);
  assert.equal(
    nextConfig.logging.incomingRequests.ignore.some((re) =>
      re.test(`/auth/confirm?token_hash=${token}&type=recovery`),
    ),
    true,
  );
  const route = readFileSync(
    new URL("../src/app/auth/confirm/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /type: "recovery"/);
  assert.match(route, /redirect\("\/set-password"\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-referrer/);
  assert.doesNotMatch(
    route,
    /console\.|localStorage|sessionStorage|searchParams.get\("(?:next|redirect_to)"\)/,
  );
  const action = readFileSync(
    new URL("../src/app/set-password/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(action, /auth.getUser\(\)/);
  assert.match(action, /validRecoveryProof/);
  assert.match(action, /auth.updateUser/);
  assert.match(action, /redirect\("\/auth\/continue"\)/);
  assert.doesNotMatch(
    action,
    /console\.|user_metadata|localStorage|sessionStorage/,
  );
});
