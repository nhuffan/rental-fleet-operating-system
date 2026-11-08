// The recovery endpoint accepts one exact flow and never trusts return URLs.
export const MIN_PASSWORD_LENGTH = 6;
export function recoveryParameters(params: URLSearchParams) {
  const tokenHash = params.get("token_hash");
  if (
    params.getAll("type").length !== 1 ||
    params.get("type") !== "recovery" ||
    params.getAll("token_hash").length !== 1 ||
    !tokenHash ||
    !/^[a-zA-Z0-9_-]{16,256}$/.test(tokenHash)
  )
    return null;
  const business = params.get("business");
  return {
    tokenHash,
    businessId:
      params.getAll("business").length === 1 &&
      business &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        business,
      )
        ? business
        : null,
  };
}
export function passwordValidation(password: unknown, confirmation: unknown) {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > 128
  )
    return `Mật khẩu cần từ ${MIN_PASSWORD_LENGTH} đến 128 ký tự.`;
  if (password !== confirmation)
    return "Hai mật khẩu chưa khớp. Vui lòng kiểm tra lại.";
  return "";
}

// Self-service reset always answers the same way so the form cannot be used to learn
// which emails have accounts. Delivery depends on the project's Auth email settings.
export const RESET_REQUEST_NOTICE =
  "Nếu email này có tài khoản, chúng tôi đã gửi link đặt lại mật khẩu. Link chỉ dùng một lần và có thời hạn ngắn; hãy kiểm tra cả thư rác.";
export function normalizeResetEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}
