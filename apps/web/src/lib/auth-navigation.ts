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
      !["/app", "/superadmin", "/portal"].some(
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

export type GrantPath = "/me" | "/platform/me" | "/portal/me";
// Server-side landing selection. A role-specific return hint never chooses the
// authorization surface: only NestJS grant responses can select one. Each surface
// (Owner, Superadmin, Customer) is an independent grant probed in turn.
export async function resolveLoginDestination(
  requested: unknown,
  grantStatus: (path: GrantPath) => Promise<number>,
) {
  const explicit = safeReturnPath(requested, "");
  const pathname = explicit.split("?")[0];
  const under = (prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix + "/");
  const owner = { path: "/me", home: "/app" } as const;
  const platform = { path: "/platform/me", home: "/superadmin" } as const;
  const customer = { path: "/portal/me", home: "/portal" } as const;
  const order = under("/superadmin")
    ? [platform, owner, customer]
    : under("/portal")
      ? [customer, owner, platform]
      : [owner, platform, customer];
  for (const [index, surface] of order.entries()) {
    const status = await grantStatus(surface.path);
    if (status === 200) return index === 0 && explicit ? explicit : surface.home;
    if (status !== 403) throw new Error("Cannot verify workspace access");
  }
  return "/access-denied";
}
