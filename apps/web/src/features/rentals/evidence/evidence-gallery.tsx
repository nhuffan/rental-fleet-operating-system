"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState } from "@/components/ui/primitives";
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
  useEffect(() => {
    if (item.kind !== "IMAGE") return;
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
  }, [item.id, item.kind, rentalId, businessId]);
  return (
    <button
      ref={ref}
      type="button"
      className="evidence-gallery-item"
      onClick={onOpen}
    >
      {image ? (
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
          {item.kind === "VIDEO" ? "Mở để phát video" : "Mở để xem ảnh"}
        </span>
      )}
      <strong>{imageLabel(item)}</strong>
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
  const [selected, setSelected] = useState<Evidence | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function load() {
    if (pending) return;
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
          onClick={() => (expanded ? setExpanded(false) : void load())}
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
                <EvidenceThumbnail
                  key={item.id}
                  item={item}
                  rentalId={rentalId}
                  businessId={businessId}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
          )}
        </>
      )}
      {selected && (
        <EvidenceViewer
          key={selected.id}
          item={selected}
          rentalId={rentalId}
          businessId={businessId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
