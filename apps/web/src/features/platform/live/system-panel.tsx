"use client";
import { DataTable } from "@/components/data-display/table";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import {
  environmentLabels,
  featureStatusLabels,
  featureTones,
  formatBytes,
  integrationStatusLabels,
  integrationTones,
  jobModeLabels,
} from "./system-presentation";
import type { PlatformSystem } from "./types";

const readOnlyNote =
  "Chỉ đọc: không có thao tác thay đổi cấu hình. Thay đổi môi trường, khóa và cấu hình Supabase do quản trị viên thực hiện ngoài ứng dụng.";

export function SystemPanel({
  mode,
  data,
}: {
  mode: "features" | "integrations" | "settings";
  data: PlatformSystem;
}) {
  if (mode === "features")
    return (
      <Panel>
        <PanelHeader
          title="Tính năng nền tảng"
          subtitle={`Trạng thái triển khai hiện tại · ${readOnlyNote}`}
          icon="grid"
        />
        <DataTable
          caption="Trạng thái tính năng"
          rows={data.features.map((f) => ({ ...f, id: f.key }))}
          columns={[
            {
              key: "label",
              label: "Tính năng",
              render: (f) => (
                <span>
                  <strong>{f.label}</strong>
                  <small className="fleet-cell-meta">{f.description}</small>
                </span>
              ),
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (f) => (
                <Badge tone={featureTones[f.status] ?? "neutral"}>
                  {featureStatusLabels[f.status] ?? f.status}
                </Badge>
              ),
            },
          ]}
        />
      </Panel>
    );
  if (mode === "integrations")
    return (
      <Panel>
        <PanelHeader
          title="Tích hợp và GPS"
          subtitle={`Chỉ hiển thị đã/chưa cấu hình, không lộ khóa hay token. ${readOnlyNote}`}
          icon="signal"
        />
        <DataTable
          caption="Trạng thái tích hợp"
          rows={data.integrations.map((i) => ({ ...i, id: i.key }))}
          columns={[
            {
              key: "label",
              label: "Tích hợp",
              render: (i) => (
                <span>
                  <strong>{i.label}</strong>
                  <small className="fleet-cell-meta">{i.detail}</small>
                </span>
              ),
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (i) => (
                <Badge tone={integrationTones[i.status] ?? "neutral"}>
                  {integrationStatusLabels[i.status] ?? i.status}
                </Badge>
              ),
            },
          ]}
        />
      </Panel>
    );
  const rows = [
    ["Môi trường", environmentLabels[data.environment] ?? data.environment],
    ["Cơ sở dữ liệu", data.database.reachable ? "Kết nối được" : "Không kết nối"],
    [
      "Migration mới nhất",
      data.database.latestMigration
        ? `${data.database.latestMigration} (${data.database.migrationCount} bản)`
        : "Không đọc được lịch sử migration",
    ],
    ["Thời điểm kiểm tra", formatDate(data.asOf)],
    [
      "Giới hạn nhận GPS (mỗi tiến trình)",
      `${data.limits.gpsRequestsPerMinute} yêu cầu/phút, ${data.limits.gpsDeviceRequestsPerMinute}/thiết bị, tối đa ${formatBytes(data.limits.gpsMaxBodyBytes)}`,
    ],
    [
      "Giới hạn ảnh/video biên bản",
      `${data.limits.evidenceMaxImages} ảnh + ${data.limits.evidenceMaxVideos} video mỗi biên bản; ${formatBytes(data.limits.evidenceMaxTenantBytes)} mỗi doanh nghiệp`,
    ],
    [
      "Giới hạn báo cáo",
      `${data.limits.reportMaxDays} ngày, ${data.limits.reportMaxRows} dòng CSV`,
    ],
  ];
  const jobRows = data.jobs.jobs.map((job) => [
    job.label,
    `${jobModeLabels[job.mode] ?? job.mode}${
      job.lastRunAt
        ? ` · chạy lần cuối ${formatDate(job.lastRunAt)} (${job.lastOutcome ?? "?"})`
        : " · chưa chạy trong tiến trình này"
    }`,
  ]);
  return (
    <>
      <Panel>
        <PanelHeader
          title="Cài đặt hệ thống"
          subtitle={readOnlyNote}
          icon="settings"
        />
        <dl className="detail-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel>
        <PanelHeader
          title="Job nền"
          subtitle={`${data.jobs.enabled ? "Đang bật" : "Đang tắt"} (JOBS_ENABLED). Trạng thái lần chạy tính theo từng tiến trình API và mất khi khởi động lại.`}
          icon="clock"
        />
        <dl className="detail-list">
          {jobRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
