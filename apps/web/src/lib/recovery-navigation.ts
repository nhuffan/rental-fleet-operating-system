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
