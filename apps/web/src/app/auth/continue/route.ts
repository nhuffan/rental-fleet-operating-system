import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { resolveLoginDestination, safeReturnPath } from "@/lib/auth-navigation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"), "");
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const login = new URLSearchParams(next ? { next } : {});
  try {
    const client = await serverClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return redirect(`/login${login.size ? `?${login}` : ""}`);
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) return redirect(`/login${login.size ? `?${login}` : ""}`);
    const business = (await cookies()).get("current-business")?.value;
    const target = await resolveLoginDestination(next, async (path) => {
      const response = await fetch(
        `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1${path}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(path === "/me" && business
              ? { "X-Business-Id": business }
              : {}),
          },
        },
      );
      return response.status;
    });
    return redirect(target);
  } catch {
    login.set("error", "workspace_unavailable");
    return redirect(`/login?${login}`);
  }
}
