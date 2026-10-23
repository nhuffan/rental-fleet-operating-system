// Only return to known local application surfaces. Never interpret a supplied URL
// as an origin, and normalize traversal before checking the path boundary.
export function safeReturnPath(value: unknown, fallback = "/app") {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://rental.invalid");
    if (
      url.origin !== "https://rental.invalid" ||
      !["/app", "/superadmin"].some(
        (prefix) =>
          url.pathname === prefix || url.pathname.startsWith(prefix + "/"),
      )
    )
      return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
export function platformLoginPath(returnPath = "/superadmin") {
  return `/login?${new URLSearchParams({ next: safeReturnPath(returnPath, "/superadmin") })}`;
}

// Server-side landing selection. A role-specific return hint never chooses the
// authorization surface: only NestJS grant responses can select one.
export async function resolveLoginDestination(
  requested: unknown,
  grantStatus: (path: "/me" | "/platform/me") => Promise<number>,
) {
  const explicit = safeReturnPath(requested, "");
  const pathname = explicit.split("?")[0];
  const prefersPlatform =
    pathname === "/superadmin" || pathname.startsWith("/superadmin/");
  const first = prefersPlatform ? "/platform/me" : "/me";
  const second = prefersPlatform ? "/me" : "/platform/me";
  const status = await grantStatus(first);
  if (status === 200)
    return explicit || (prefersPlatform ? "/superadmin" : "/app");
  if (status !== 403) throw new Error("Cannot verify workspace access");
  const other = await grantStatus(second);
  if (other === 200) return prefersPlatform ? "/app" : "/superadmin";
  if (other === 403) return "/access-denied";
  throw new Error("Cannot verify workspace access");
}
