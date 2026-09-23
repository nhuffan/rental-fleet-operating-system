import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "./lib/env";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const c = publicEnv();
  const supabase = createServerClient(c.url, c.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, cacheHeaders) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response.cookies.getAll();
        response = NextResponse.next({ request });
        previous.forEach((cookie) => response.cookies.set(cookie));
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(cacheHeaders ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if ((!user || error) && request.nextUrl.pathname.startsWith("/app")) {
    const target = new URL("/login", request.url);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/app/:path*", "/login", "/access-denied"] };
