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

// This selects a landing page only. Each destination still verifies its own
// independent backend grant in its protected layout.
export async function resolveLoginDestination(
  requested: unknown,
  grantStatus: (path: "/me" | "/platform/me") => Promise<number>,
) {
  const explicit = safeReturnPath(requested, "");
  if (explicit) return explicit;
  const tenant = await grantStatus("/me");
  if (tenant === 200) return "/app";
  if (tenant !== 403) throw new Error("Cannot verify workspace access");
  const platform = await grantStatus("/platform/me");
  if (platform === 200) return "/superadmin";
  if (platform === 403) return "/access-denied";
  throw new Error("Cannot verify workspace access");
}
