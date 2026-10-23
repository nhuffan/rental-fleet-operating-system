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
