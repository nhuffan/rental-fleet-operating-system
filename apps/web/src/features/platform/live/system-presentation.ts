// Pure labels (no path aliases) so the node test runner can import them directly.
export const integrationStatusLabels: Record<string, string> = {
  CONFIGURED: "Đã cấu hình",
  NOT_CONFIGURED: "Chưa cấu hình",
  TEST_ONLY: "Chỉ nguồn TEST",
  PUBLIC: "Dịch vụ công cộng",
};
export const integrationTones: Record<
  string,
  "success" | "danger" | "info" | "warning"
> = {
  CONFIGURED: "success",
  NOT_CONFIGURED: "danger",
  TEST_ONLY: "info",
  PUBLIC: "warning",
};
export const featureStatusLabels: Record<string, string> = {
  AVAILABLE: "Đã triển khai",
  TEST: "Chỉ dữ liệu TEST",
  NOT_IMPLEMENTED: "Chưa triển khai",
};
export const featureTones: Record<string, "success" | "info" | "neutral"> = {
  AVAILABLE: "success",
  TEST: "info",
  NOT_IMPLEMENTED: "neutral",
};
export const environmentLabels: Record<string, string> = {
  development: "Phát triển (development)",
  test: "Kiểm thử (test)",
  staging: "Thử nghiệm (staging)",
  production: "Vận hành (production)",
};
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024)
    return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MiB`;
  if (bytes >= 1024) return `${Math.round((bytes / 1024) * 10) / 10} KiB`;
  return `${bytes} byte`;
}
