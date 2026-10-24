type UploadAuthorization = {
  id: string;
  status: string;
  expiresAt: string;
};
function stopped(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Đã hủy", "AbortError");
}
function verified(result: { status: string }) {
  return result.status === "VERIFIED" || result.status === "ATTACHED";
}
/** Verify before a manual retry: a lost upload response must not duplicate a file. */
export async function transferMedia<A extends UploadAuthorization>({
  authorization,
  authorize,
  verify,
  upload,
  signal,
  onAuthorized,
  onStage,
}: {
  authorization?: A;
  authorize: () => Promise<A>;
  verify: (authorization: A) => Promise<{ status: string }>;
  upload: (authorization: A) => Promise<void>;
  signal: AbortSignal;
  onAuthorized: (authorization: A) => void;
  onStage: (stage: "uploading" | "verifying") => void;
}) {
  stopped(signal);
  if (authorization) {
    onStage("verifying");
    try {
      const result = await verify(authorization);
      stopped(signal);
      if (verified(result)) return;
      throw new Error("Server chưa xác minh file. Vui lòng thử lại.");
    } catch (error) {
      stopped(signal);
      // Reupload only when the server explicitly confirms the pending object is absent.
      // Permission, decoder and lease errors must remain visible and fail closed.
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "EVIDENCE_NOT_READY"
      )
        throw error;
    }
  }
  const current = await authorize();
  onAuthorized(current);
  stopped(signal);
  if (new Date(current.expiresAt).getTime() <= Date.now())
    throw new Error("Phiên upload hết hạn. Bỏ file và chọn lại.");
  if (verified(current)) return;
  onStage("uploading");
  try {
    await upload(current);
  } catch (error) {
    stopped(signal);
    // A complete object may have reached Storage before the connection failed.
    // Verification decides whether it can be accepted; no blind automatic retry.
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
  }
  stopped(signal);
  onStage("verifying");
  const result = await verify(current);
  stopped(signal);
  if (!verified(result))
    throw new Error("Server chưa xác minh file. Vui lòng thử lại.");
}
