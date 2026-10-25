"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { FormDialog } from "@/components/ui/form-dialog";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/query";
import type {
  Evidence,
  EvidenceReadAuthorization,
  RentalEvidence,
} from "../types";
import { EvidenceError, evidenceRequest } from "./client";
import { evidenceCategories } from "./use-evidence-draft";
import { formatBytes } from "./media-policy";
import {
  readableMedia,
  retentionLabels,
  type MediaRetentionStatus,
} from "./retention-presentation";
import {
  EvidenceDownload,
  EvidenceImportantControl,
  matchesRetentionChange,
  retentionChangedEvent,
} from "./retention-controls";
function imageLabel(item: Evidence) {
  return `${item.kind === "IMAGE" ? "Ảnh" : "Video"} · ${evidenceCategories[item.category]}`;
}
function EvidenceThumbnail({
  item,
  rentalId,
  businessId,
  onOpen,
}: {
  item: Evidence;
  rentalId: string;
  businessId: string;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [image, setImage] = useState("");
  const readable = readableMedia(item);
  useEffect(() => {
    if (item.kind !== "IMAGE" || !readable) return;
    const controller = new AbortController();
    let observer: IntersectionObserver | undefined;
    const load = () => {
      void evidenceRequest<EvidenceReadAuthorization>(
        businessId,
        `/rentals/${rentalId}/evidence/${item.id}/url`,
        "GET",
        undefined,
        controller.signal,
      )
        .then((value) => setImage(value.url))
        .catch(() => undefined);
    };
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      });
      if (ref.current) observer.observe(ref.current);
    } else load();
    return () => {
      controller.abort();
      observer?.disconnect();
    };
  }, [item.id, item.kind, readable, rentalId, businessId]);
  return (
    <button
      ref={ref}
      type="button"
      className="evidence-gallery-item"
      disabled={!readableMedia(item)}
      onClick={onOpen}
    >
      {image && readableMedia(item) ? (
        <Image
          src={image}
          unoptimized
          loading="lazy"
          width={240}
          height={160}
          alt={imageLabel(item)}
          onError={() => setImage("")}
        />
      ) : (
        <span className="evidence-gallery-placeholder">
          <Icon name={item.kind === "IMAGE" ? "image" : "video"} size={28} />
          {!readableMedia(item)
            ? item.retentionStatus === "PURGED"
              ? "File đã bị xóa vĩnh viễn"
              : "File hiện không thể mở"
            : item.kind === "VIDEO"
              ? "Mở để phát video"
              : "Mở để xem ảnh"}
        </span>
      )}
      <strong>{imageLabel(item)}</strong>
      <Badge
        tone={
          item.retentionStatus === "PURGED"
            ? "neutral"
            : item.retentionStatus === "ACTIVE"
              ? "success"
              : "warning"
        }
      >
        {retentionLabels[item.retentionStatus as MediaRetentionStatus] ??
          "Chưa rõ trạng thái"}
      </Badge>
      <small>
        {formatBytes(item.bytes)}
        {item.durationSeconds
          ? ` · ${item.durationSeconds.toLocaleString("vi-VN")} giây`
          : ""}
      </small>
    </button>
  );
}
function EvidenceViewer({
  item,
  rentalId,
  businessId,
  onClose,
}: {
  item: Evidence;
  rentalId: string;
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [read, setRead] = useState<EvidenceReadAuthorization | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const media = useRef<HTMLDivElement>(null);
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void evidenceRequest<EvidenceReadAuthorization>(
      businessId,
      `/rentals/${rentalId}/evidence/${item.id}/url`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        setRead(value);
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof EvidenceError && error.status === 401)
            router.replace("/login");
          setError(
            error instanceof Error ? error.message : "Chưa tải được file.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [item.id, rentalId, businessId, attempt, router]);
  return (
    <FormDialog
      title={imageLabel(item)}
      description={`Ghi nhận ${formatDate(item.createdAt)} · ${formatBytes(item.bytes)}`}
      size="wide"
      onClose={onClose}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          <Icon name="close" />
          Đóng
        </Button>
      }
    >
      <div className="evidence-viewer" ref={media}>
        {loading && <p role="status">Đang cấp quyền xem file…</p>}
        {error && (
          <p role="alert" className="notice notice-danger">
            {error}
          </p>
        )}
        {read &&
          !error &&
          (item.kind === "IMAGE" ? (
            <Image
              src={read.url}
              unoptimized
              width={item.width}
              height={item.height}
              alt={imageLabel(item)}
              onError={() =>
                setError("Link xem ảnh có thể đã hết hạn. Hãy lấy link mới.")
              }
            />
          ) : (
            <video
              key={read.url}
              src={read.url}
              controls
              preload="none"
              playsInline
              onError={() =>
                setError(
                  "Link video có thể đã hết hạn hoặc trình duyệt không phát được định dạng này.",
                )
              }
              aria-label={imageLabel(item)}
            />
          ))}
        <p className="quiet">
          Link xem private có thời hạn ngắn. Nếu phát/xem bị gián đoạn, lấy link
          mới và mở lại; video không tự tải trước.
        </p>
        {read && !error && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFullscreenError("");
              const target = media.current;
              if (!target?.requestFullscreen) {
                setFullscreenError(
                  "Trình duyệt này chưa hỗ trợ xem toàn màn hình. Bạn vẫn có thể xem trong cửa sổ này.",
                );
                return;
              }
              void target
                .requestFullscreen()
                .catch(() =>
                  setFullscreenError(
                    "Chưa mở được chế độ toàn màn hình. Hãy thử lại.",
                  ),
                );
            }}
          >
            <Icon name="expand" />
            Xem toàn màn hình
          </Button>
        )}
        {fullscreenError && (
          <p role="status" className="quiet">
            {fullscreenError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          loading={loading}
          onClick={() => {
            setError("");
            setRead(null);
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          <Icon name="retry" />
          Lấy link xem mới
        </Button>
      </div>
    </FormDialog>
  );
}
export function EvidenceGallery({
  rentalId,
  businessId,
  type,
}: {
  rentalId: string;
  businessId: string;
  type: "HANDOVER" | "RETURN";
}) {
  const router = useRouter();
  const [data, setData] = useState<Evidence[] | null>(null);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.find((item) => item.id === selectedId);
  const expandedRef = useRef(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function load() {
    expandedRef.current = true;
    setExpanded(true);
    setPending(true);
    setError("");
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await evidenceRequest<RentalEvidence>(
        businessId,
        `/rentals/${rentalId}/evidence`,
        "GET",
        undefined,
        controller.signal,
      );
      setData(response.data.filter((item) => item.type === type));
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof EvidenceError && error.status === 401)
          router.replace("/login");
        setError(
          error instanceof Error
            ? error.message
            : "Chưa thể tải danh sách chứng cứ.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  useEffect(() => {
    const refresh = (event: Event) => {
      if (
        matchesRetentionChange(event, businessId, rentalId) &&
        expandedRef.current
      )
        void load();
    };
    window.addEventListener(retentionChangedEvent, refresh);
    return () => window.removeEventListener(retentionChangedEvent, refresh);
  });
  return (
    <div
      className="evidence-gallery"
      aria-label={`Chứng cứ ${type === "HANDOVER" ? "bàn giao" : "nhận trả"}`}
    >
      <div className="evidence-gallery-heading">
        <h3>Ảnh & video minh chứng</h3>
        <Button
          type="button"
          variant="secondary"
          size="small"
          loading={pending}
          aria-expanded={expanded}
          onClick={() => {
            if (expanded) {
              expandedRef.current = false;
              setExpanded(false);
            } else void load();
          }}
        >
          <Icon name="rental" />
          {expanded ? "Thu gọn chứng cứ" : "Xem chứng cứ"}
        </Button>
      </div>
      {expanded && (
        <>
          {pending && <p role="status">Đang tải metadata chứng cứ…</p>}
          {error && (
            <div>
              <p role="alert" className="notice notice-danger">
                {error}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void load()}
              >
                <Icon name="retry" />
                Thử lại
              </Button>
            </div>
          )}
          {data?.length === 0 && !pending && (
            <EmptyState
              icon="rental"
              title="Chưa có ảnh/video minh chứng"
              description="Biên bản vẫn giữ dữ liệu kiểm tra đã ghi nhận. Chứng cứ không được bổ sung giả cho các mốc cũ."
            />
          )}
          {!!data?.length && (
            <div className="evidence-gallery-grid">
              {data.map((item) => (
                <article key={item.id} className="evidence-retention-card">
                  <EvidenceThumbnail
                    item={item}
                    rentalId={rentalId}
                    businessId={businessId}
                    onOpen={() => setSelectedId(item.id)}
                  />
                  <div className="evidence-retention-meta">
                    {(item.important || item.legalHold) && (
                      <div className="evidence-actions">
                        {item.important && (
                          <Badge tone="brand">Quan trọng</Badge>
                        )}
                        {item.legalHold && (
                          <Badge tone="warning">
                            {item.unresolvedDispute
                              ? "Giữ vì tranh chấp"
                              : "Đang giữ hồ sơ"}
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className="quiet">
                      {item.retentionStatus === "PURGED"
                        ? `Đã xóa ${item.purgedAt ? formatDate(item.purgedAt) : ""}. Nội dung không thể khôi phục; thông tin biên bản vẫn được lưu.`
                        : item.important || item.legalHold
                          ? "Được giữ lại cho đến khi Owner gỡ bảo vệ."
                          : item.retentionDeadline
                            ? `Thời hạn lưu: ${formatDate(item.retentionDeadline)}`
                            : "Chưa tính hạn lưu: hợp đồng chưa hoàn tất hoặc thiếu thời điểm hoàn tất hợp lệ."}
                    </p>
                    {item.retentionStatus === "PURGE_ELIGIBLE" && (
                      <p className="quiet">
                        File đã hết hạn xem/tải. Có thể giữ lại nếu quá trình
                        xóa chưa bắt đầu.
                      </p>
                    )}
                    {item.retentionStatus === "RETRY_REQUIRED" && (
                      <p className="quiet">
                        Trạng thái xóa chưa chắc chắn. File được khóa xem và
                        thay đổi bảo vệ cho đến khi xử lý xong.
                      </p>
                    )}
                    <div className="evidence-actions">
                      <EvidenceImportantControl
                        item={item}
                        rentalId={rentalId}
                        businessId={businessId}
                      />
                      <EvidenceDownload
                        item={item}
                        rentalId={rentalId}
                        businessId={businessId}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {selected && readableMedia(selected) && (
        <EvidenceViewer
          key={selected.id}
          item={selected}
          rentalId={rentalId}
          businessId={businessId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
