"use client";
import Image from "next/image";
import { useRef } from "react";
import { Button, Select } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import {
  evidenceCategories,
  type EvidenceCategory,
  type useEvidenceDraft,
} from "./use-evidence-draft";
import { formatBytes } from "./media-policy";
const stageLabels = {
  preparing: "Đang chuẩn bị",
  compressing: "Đang nén",
  ready: "Sẵn sàng upload",
  uploading: "Đang upload",
  verifying: "Server đang kiểm tra",
  verified: "Đã sẵn sàng gắn",
  failed: "Chưa hoàn tất",
  cancelled: "Đã hủy",
} as const;
export function EvidenceUploader({
  draft,
  disabled,
}: {
  draft: ReturnType<typeof useEvidenceDraft>;
  disabled: boolean;
}) {
  const images = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const recorder = useRef<HTMLInputElement>(null);
  return (
    <section
      className="inspection-form-section evidence-draft"
      aria-label="Ảnh và video minh chứng"
    >
      <h3>Ảnh & video minh chứng</h3>
      <p className="quiet">
        Tối đa 8 ảnh (1 MB/ảnh) và 1 video (30 giây, 12 MB), tổng 20 MB. Chọn
        góc chụp và xem bản sau nén trước khi upload. File chỉ được gắn khi xác
        nhận biên bản.
      </p>
      <div className="evidence-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || draft.working}
          onClick={() => images.current?.click()}
        >
          <Icon name="image" />
          Chọn ảnh
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || draft.working}
          onClick={() => camera.current?.click()}
        >
          <Icon name="camera" />
          Chụp ảnh
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || draft.working}
          onClick={() => video.current?.click()}
        >
          <Icon name="video" />
          Chọn video
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || draft.working}
          onClick={() => recorder.current?.click()}
        >
          <Icon name="video" />
          Quay video
        </Button>
        {draft.tasks.some(
          (item) => item.stage === "ready" || item.stage === "failed",
        ) && (
          <Button
            type="button"
            disabled={disabled || draft.working}
            onClick={() => void draft.upload()}
          >
            <Icon name="arrow" />
            Upload các file đã kiểm tra
          </Button>
        )}
        {draft.working && (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={draft.cancelActive}
          >
            <Icon name="close" />
            Dừng file đang xử lý
          </Button>
        )}
      </div>
      <input
        ref={images}
        className="sr-only"
        type="file"
        tabIndex={-1}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        disabled={disabled || draft.working}
        aria-label="Chọn ảnh minh chứng"
        onChange={(event) => {
          const files = event.currentTarget.files;
          void draft.add(files, "IMAGE");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={video}
        className="sr-only"
        type="file"
        tabIndex={-1}
        accept="video/mp4,video/webm,video/quicktime"
        disabled={disabled || draft.working}
        aria-label="Chọn video minh chứng"
        onChange={(event) => {
          const files = event.currentTarget.files;
          void draft.add(files, "VIDEO");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={camera}
        className="sr-only"
        type="file"
        tabIndex={-1}
        accept="image/*"
        capture="environment"
        disabled={disabled || draft.working}
        aria-label="Chụp ảnh minh chứng bằng camera"
        onChange={(event) => {
          const files = event.currentTarget.files;
          void draft.add(files, "IMAGE");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={recorder}
        className="sr-only"
        type="file"
        tabIndex={-1}
        accept="video/*"
        capture="environment"
        disabled={disabled || draft.working}
        aria-label="Quay video minh chứng bằng camera"
        onChange={(event) => {
          const files = event.currentTarget.files;
          void draft.add(files, "VIDEO");
          event.currentTarget.value = "";
        }}
      />
      {draft.message && (
        <p role="alert" className="notice notice-warning">
          {draft.message}
        </p>
      )}
      {draft.tasks.length > 0 && (
        <ul className="evidence-draft-list">
          {draft.tasks.map((item, index) => (
            <li key={item.id} className="evidence-draft-item">
              <div className="evidence-draft-heading">
                <strong>
                  {item.kind === "IMAGE" ? "Ảnh" : "Video"} {index + 1}
                </strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  disabled={disabled}
                  onClick={() => void draft.remove(item.id)}
                  aria-label={`Bỏ ${item.kind === "IMAGE" ? "ảnh" : "video"} ${index + 1}`}
                >
                  <Icon name="close" />
                  Bỏ file
                </Button>
              </div>
              <span className="evidence-file-name" title={item.original.name}>
                {item.original.name}
              </span>
              <label className="form-field">
                Góc chụp / nội dung
                <Select
                  aria-label={`Góc chụp file ${index + 1}`}
                  value={item.category}
                  disabled={disabled || !!item.authorization || draft.working}
                  onChange={(event) =>
                    draft.setCategory(
                      item.id,
                      event.target.value as EvidenceCategory,
                    )
                  }
                >
                  {Object.entries(evidenceCategories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="evidence-previews">
                <details>
                  <summary>Bản gốc · {formatBytes(item.original.size)}</summary>
                  {item.kind === "IMAGE" ? (
                    <Image
                      src={item.originalUrl}
                      width={240}
                      height={180}
                      unoptimized
                      alt={`Ảnh gốc ${index + 1}, chỉ xem trên thiết bị`}
                    />
                  ) : (
                    <video
                      src={item.originalUrl}
                      controls
                      preload="none"
                      playsInline
                      aria-label={`Video gốc ${index + 1}`}
                    />
                  )}
                </details>
                {item.preparedUrl && (
                  <details open>
                    <summary>
                      {item.prepared?.blob === item.original
                        ? "File gốc đạt giới hạn"
                        : "Sau nén"}{" "}
                      · {formatBytes(item.prepared?.blob.size ?? 0)}
                    </summary>
                    {item.kind === "IMAGE" ? (
                      <Image
                        src={item.preparedUrl}
                        width={240}
                        height={180}
                        unoptimized
                        alt={`Ảnh sau nén ${index + 1}`}
                      />
                    ) : (
                      <video
                        src={item.preparedUrl}
                        poster={item.posterUrl}
                        controls
                        preload="none"
                        playsInline
                        aria-label={`Video đã chuẩn bị ${index + 1}`}
                      />
                    )}
                  </details>
                )}
              </div>
              {item.prepared && (
                <p className="quiet">{item.prepared.message}</p>
              )}
              <p
                className={`evidence-upload-state evidence-state-${item.stage}`}
                role="status"
              >
                {stageLabels[item.stage]}
                {["compressing", "uploading"].includes(item.stage)
                  ? ` · ${item.progress}%`
                  : ""}
              </p>
              {["compressing", "uploading"].includes(item.stage) && (
                <progress
                  value={item.progress}
                  max={100}
                  aria-label={`Tiến trình file ${index + 1}`}
                />
              )}
              {item.error && (
                <p role="alert" className="evidence-error">
                  {item.error}
                </p>
              )}
              {["ready", "failed"].includes(item.stage) && (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={disabled || draft.working}
                  onClick={() => void draft.upload(item.id)}
                >
                  <Icon name={item.stage === "failed" ? "retry" : "arrow"} />
                  {item.stage === "failed"
                    ? "Thử lại / kiểm tra upload"
                    : "Upload file này"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="quiet">
        Video được nén từng file, có thể mất gần bằng độ dài clip. Trên kết nối
        gián đoạn, thử lại sẽ kiểm tra file đã lưu trước; nếu chưa đủ dữ liệu,
        upload lại toàn bộ file (tối đa 12 MB). Không có chế độ tiếp tục từ byte
        bị ngắt. Khi bỏ bản nháp, file chưa gắn vào biên bản sẽ hết hạn và được
        dọn bởi tác vụ bảo trì của hệ thống.
      </p>
    </section>
  );
}
