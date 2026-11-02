import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import { recoveryParameters } from "@/lib/recovery-navigation";
import {
  createRecoveryProof,
  RECOVERY_COOKIE,
  RECOVERY_WINDOW_SECONDS,
} from "@/lib/recovery-proof";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const store = await cookies();
  const options = {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: request.nextUrl.protocol === "https:",
  };
  // A failed link must not reuse a previous recovery flow.
  store.set(RECOVERY_COOKIE, "", { ...options, maxAge: 0 });
  const parameters = recoveryParameters(request.nextUrl.searchParams);
  if (!parameters) return redirect("/login?error=link_invalid");
  try {
    const client = await serverClient();
    const { data, error } = await client.auth.verifyOtp({
      token_hash: parameters.tokenHash,
      type: "recovery",
    });
    if (error || !data.user || !data.session)
      return redirect("/login?error=link_invalid");
    store.set(
      RECOVERY_COOKIE,
      createRecoveryProof(data.user.id, data.session.access_token),
      {
        ...options,
        maxAge: RECOVERY_WINDOW_SECONDS,
      },
    );
    // This is a selection hint only. NestJS independently validates membership.
    store.set("current-business", parameters.businessId ?? "", {
      path: "/",
      sameSite: "lax",
      secure: options.secure,
      ...(parameters.businessId ? {} : { maxAge: 0 }),
    });
    return redirect("/set-password");
  } catch {
    return redirect("/login?error=link_invalid");
  }
}
