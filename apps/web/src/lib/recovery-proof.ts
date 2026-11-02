import { createHmac, timingSafeEqual } from "node:crypto";
export const RECOVERY_COOKIE = "rental-recovery-flow";
export const RECOVERY_WINDOW_SECONDS = 15 * 60;
// This short-lived cookie gates the recovery UI only. Supabase still verifies
// the identity and permits updateUser only for that authenticated account.
export function createRecoveryProof(
  userId: string,
  accessToken: string,
  now = Date.now(),
) {
  const expires = now + RECOVERY_WINDOW_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  const signature = createHmac("sha256", accessToken)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}
export function validRecoveryProof(
  value: string | undefined,
  userId: string,
  accessToken: string,
  now = Date.now(),
) {
  if (!value || value.length > 160 || !accessToken) return false;
  const [owner, expiresValue, signature, extra] = value.split(".");
  const expires = Number(expiresValue);
  if (
    extra !== undefined ||
    owner !== userId ||
    !/^\d{13}$/.test(expiresValue ?? "") ||
    !Number.isSafeInteger(expires) ||
    expires <= now ||
    expires > now + RECOVERY_WINDOW_SECONDS * 1000 ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  )
    return false;
  const expected = createHmac("sha256", accessToken)
    .update(`${owner}.${expiresValue}`)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}
