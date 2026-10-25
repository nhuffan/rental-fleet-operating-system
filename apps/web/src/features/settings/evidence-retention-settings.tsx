"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Panel,
  PanelHeader,
  Select,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { MetricCard } from "@/components/data-display/metric-card";
import type {
  EvidenceRetentionSettings,
  EvidenceStorageUsage,
} from "@/features/rentals/types";
import {
  EvidenceError,
  evidenceRequest,
} from "@/features/rentals/evidence/client";
import { formatBytes } from "@/features/rentals/evidence/media-policy";
import { notifyRetentionChanged } from "@/features/rentals/evidence/retention-controls";
export function EvidenceRetentionSettingsPanel({
  businessId,
  editable,
}: {
  businessId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<EvidenceRetentionSettings | null>(
    null,
  );
  const [usage, setUsage] = useState<EvidenceStorageUsage | null>(null);
  const [days, setDays] = useState("30");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    void Promise.all([
      evidenceRequest<EvidenceRetentionSettings>(
        businessId,
        "/evidence/retention/settings",
        "GET",
        undefined,
        controller.signal,
      ),
      evidenceRequest<EvidenceStorageUsage>(
        businessId,
        "/evidence/storage-usage",
        "GET",
        undefined,
        controller.signal,
      ),
    ])
      .then(([policy, summary]) => {
        if (controller.signal.aborted) return;
        setSettings(policy);
        setUsage(summary);
        setDays(String(policy.retentionDays));
        setLoading(false);
        setError("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof EvidenceError && error.status === 401)
          router.replace("/login");
        setError(
          error instanceof Error
            ? error.message
            : "Chưa tải được dung lượng chứng cứ.",
        );
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [businessId, attempt, router]);
  function reload() {
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  return (
    <Panel>
      <PanelHeader
        title="Lưu trữ ảnh & video minh chứng"
        icon="storage"
        subtitle="Dung lượng và thời hạn lưu của doanh nghiệp hiện tại"
        action={
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            loading={loading}
            onClick={reload}
          >
            <Icon name="retry" />
            Làm mới
          </Button>
        }
      />
      <div className="evidence-retention-body">
        {error && (
          <p role="alert" className="notice notice-danger">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice notice-success">
            {message}
          </p>
        )}
        {loading && <p role="status">Đang tải thông tin lưu trữ…</p>}
        {usage && (
          <>
            <div className="evidence-budget-summary">
              <div>
                <strong>{formatBytes(usage.totalReservedBytes)}</strong> /{" "}
                {formatBytes(usage.limits.maxTenantBytes)} đã dùng hoặc giữ chỗ
              </div>
              <progress
                value={usage.totalReservedBytes}
                max={usage.limits.maxTenantBytes}
                aria-label="Dung lượng chứng cứ đã dùng hoặc giữ chỗ"
              />
              <p className="quiet">
                Bao gồm dự phòng cho file tạm và bản đã kiểm tra. Dung lượng
                upload tạm chỉ được giải phóng sau khi token upload hết hiệu
                lực.
              </p>
            </div>
            <div className="metric-grid evidence-storage-grid">
              <MetricCard
                label="Chưa bắt đầu tính hạn"
                value={`${usage.active.count.toLocaleString("vi-VN")} file`}
                description={`${formatBytes(usage.active.bytes)} · chưa bắt đầu thời hạn sau hoàn tất`}
                icon="rental"
              />
              <MetricCard
                label="Upload tạm / giữ chỗ"
                value={`${usage.pending.count.toLocaleString("vi-VN")} phiên`}
                description={`${formatBytes(usage.pending.bytes)} giữ chỗ cho file đang chờ xử lý`}
                icon="clock"
                tone="info"
              />
              <MetricCard
                label="Lưu sau hoàn tất"
                value={`${usage.retained.count.toLocaleString("vi-VN")} file`}
                description={`${formatBytes(usage.retained.bytes)} · áp dụng thời hạn lưu`}
                icon="image"
              />
              <MetricCard
                label="Đang được bảo vệ"
                value={`${usage.held.count.toLocaleString("vi-VN")} file`}
                description={`${formatBytes(usage.held.bytes)} · Quan trọng hoặc hồ sơ đang giữ`}
                icon="shield"
                tone="warning"
              />
              <MetricCard
                label="Đã xóa vĩnh viễn"
                value={`${usage.purged.count.toLocaleString("vi-VN")} file`}
                description={`${formatBytes(usage.purged.bytes)} trước khi xóa · chỉ còn metadata`}
                icon="audit"
              />
            </div>
          </>
        )}
        {settings && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving.current || !editable) return;
              saving.current = true;
              setBusy(true);
              setError("");
              setMessage("");
              const controller = new AbortController();
              active.current = controller;
              try {
                const saved = await evidenceRequest<EvidenceRetentionSettings>(
                  businessId,
                  "/evidence/retention/settings",
                  "PATCH",
                  { retentionDays: Number(days) },
                  controller.signal,
                );
                if (controller.signal.aborted) return;
                setSettings(saved);
                setMessage("Đã lưu thời hạn giữ chứng cứ cho doanh nghiệp.");
                notifyRetentionChanged(businessId);
                reload();
              } catch (error) {
                if (controller.signal.aborted) return;
                if (error instanceof EvidenceError && error.status === 401)
                  router.replace("/login");
                setError(
                  error instanceof Error
                    ? error.message
                    : "Chưa lưu được thời hạn.",
                );
              } finally {
                saving.current = false;
                if (!controller.signal.aborted) setBusy(false);
              }
            }}
          >
            <fieldset
              disabled={!editable || busy || loading}
              className="form-fieldset"
            >
              <label className="form-field">
                Giữ ảnh/video sau khi hợp đồng hoàn tất
                <Select
                  name="retentionDays"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                >
                  <option value="30">30 ngày</option>
                  <option value="90">90 ngày</option>
                </Select>
                <small>
                  Luôn giữ trong thời gian thuê. Chỉ tính hạn từ thời điểm hoàn
                  tất hợp lệ, không tính từ ngày dự kiến trả.
                </small>
              </label>
              {Number(days) < settings.retentionDays && (
                <p className="notice notice-warning">
                  Giảm thời hạn có thể làm file cũ đủ điều kiện xóa sớm hơn.
                  File quan trọng và hồ sơ đang giữ vẫn được bảo vệ.
                </p>
              )}
              <p className="quiet">
                Đây là chính sách vận hành của doanh nghiệp, không phải thời hạn
                luật định. Hợp đồng chưa hoàn tất, đã hủy hoặc thiếu thời điểm
                hoàn tất không tự trở thành hồ sơ được xóa.
              </p>
              <p className="quiet">
                File đã bị xóa sẽ vĩnh viễn không thể xem hoặc tải lại.
                Checklist, km, nhiên liệu và lịch sử biên bản vẫn được giữ.
              </p>
              <Badge tone={settings.deletionEnabled ? "warning" : "info"}>
                {settings.deletionEnabled
                  ? "Đang cho phép dọn media trên development"
                  : "Chế độ xem trước · Chưa xóa theo retention"}
              </Badge>
              <p className="quiet">
                Bật xóa là cấu hình riêng ở backend development; biểu mẫu này
                chỉ thay đổi số ngày lưu.
              </p>
              {editable && (
                <div className="form-actions">
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={String(settings.retentionDays) === days}
                  >
                    <Icon name="check" />
                    Lưu thời hạn
                  </Button>
                </div>
              )}
            </fieldset>
          </form>
        )}
      </div>
    </Panel>
  );
}
