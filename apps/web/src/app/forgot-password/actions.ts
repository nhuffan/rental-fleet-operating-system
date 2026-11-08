"use server";
import { serverClient } from "@/lib/supabase/server";
import {
  normalizeResetEmail,
  RESET_REQUEST_NOTICE,
} from "@/lib/recovery-navigation";

export type ResetState = { message: string; error: string };
export async function requestPasswordReset(
  _previous: ResetState,
  form: FormData,
): Promise<ResetState> {
  const email = normalizeResetEmail(form.get("email"));
  if (!email) return { message: "", error: "Nhập một địa chỉ email hợp lệ." };
  try {
    const client = await serverClient();
    // The result is deliberately ignored: success, unknown email, a disabled account and
    // provider rate limits all look identical. The email link opens /auth/confirm.
    await client.auth.resetPasswordForEmail(email);
  } catch {
    /* Same generic notice; never reveal provider state or log the address. */
  }
  return { message: RESET_REQUEST_NOTICE, error: "" };
}
