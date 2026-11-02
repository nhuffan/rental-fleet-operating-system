import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, validRecoveryProof } from "@/lib/recovery-proof";
import { SetPasswordForm } from "./set-password-form";
export const dynamic = "force-dynamic";
export default async function SetPasswordPage() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const {
    data: { session },
  } = await client.auth.getSession();
  const flow = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!session || !validRecoveryProof(flow, user.id, session.access_token))
    redirect("/login?error=link_invalid");
  return <SetPasswordForm />;
}
