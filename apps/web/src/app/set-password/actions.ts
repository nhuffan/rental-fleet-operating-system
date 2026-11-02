"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { passwordValidation } from "@/lib/recovery-navigation";
import { RECOVERY_COOKIE, validRecoveryProof } from "@/lib/recovery-proof";

export type PasswordState = { error: string };
export async function setPassword(
  _previous: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  const password = form.get("password");
  const error = passwordValidation(password, form.get("confirmation"));
  if (error) return { error };
  const store = await cookies();
  try {
    const client = await serverClient();
    const {
      data: { user },
      error: identityError,
    } = await client.auth.getUser();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (
      identityError ||
      !user ||
      !session ||
      !validRecoveryProof(
        store.get(RECOVERY_COOKIE)?.value,
        user.id,
        session.access_token,
      )
    )
      return {
        error: "Phiên đặt mật khẩu đã hết hạn. Nhờ quản trị viên cấp lại link.",
      };
    const { error: updateError } = await client.auth.updateUser({
      password: password as string,
    });
    if (updateError)
      return {
        error:
          "Chưa thể đặt mật khẩu. Hãy dùng mật khẩu mạnh hơn hoặc xin link mới rồi thử lại.",
      };
    store.delete(RECOVERY_COOKIE);
  } catch {
    return { error: "Chưa thể kết nối để đặt mật khẩu. Vui lòng thử lại." };
  }
  // The server checks independent tenant/platform grants, retaining the verified
  // business selection hint from recovery. No role is supplied by the form.
  redirect("/auth/continue");
}
