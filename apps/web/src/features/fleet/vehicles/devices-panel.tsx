"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { Icon } from "@/components/ui/icon";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import type { GpsDevice, GpsDevicePage } from "./types";
import { formatDate, queryString } from "@/lib/query";
import type { DeviceFilters } from "./query";
import { FleetStatus } from "./fleet-status";
import { ListFilters } from "./list-filters";
import { DeviceEditor } from "./device-editor";
export function DevicesPanel({
  initial,
  context,
  filters,
}: {
  initial: GpsDevicePage;
  context: Me;
  filters: DeviceFilters;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<GpsDevice | "new" | null>(null);
  const editable = context.permissions.includes("gps.manage");
  const navigate = (values: Record<string, string | number>) =>
    startTransition(() =>
      router.push(`/app/vehicles/devices?${queryString(values)}`, {
        scroll: false,
      }),
    );
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title="Danh mục thiết bị"
          subtitle={`${initial.total} thiết bị phù hợp bộ lọc`}
          icon="signal"
          action={
            editable && (
              <Button onClick={() => setEditing("new")}>
                <Icon name="plus" size={15} />
                Đăng ký thiết bị
              </Button>
            )
          }
        />
        <ListFilters
          kind="devices"
          filters={filters}
          pending={pending}
          onApply={navigate}
        />
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
          <DataTable
            caption="Danh mục thiết bị GPS của doanh nghiệp"
            rows={initial.data}
            columns={[
              {
                key: "uid",
                label: "UID thiết bị",
                render: (device) => <strong>{device.deviceUid}</strong>,
              },
              {
                key: "label",
                label: "Nhãn",
                render: (device) => device.label || "Chưa đặt nhãn",
              },
              {
                key: "provider",
                label: "Nhà cung cấp",
                render: (device) => device.provider,
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (device) => <FleetStatus status={device.status} />,
              },
              {
                key: "created",
                label: "Ngày đăng ký",
                render: (device) => formatDate(device.createdAt),
              },
              ...(editable
                ? [
                    {
                      key: "action",
                      label: "Thao tác",
                      render: (device: GpsDevice) => (
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(device)}
                        >
                          Chỉnh sửa
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            disabled={pending}
            {...initial}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
      <p className="quiet fleet-footnote">
        Trạng thái Hoạt động/Ngưng hoạt động là vòng đời đăng ký thiết bị, không
        phản ánh kết nối GPS.
      </p>
      {editing && (
        <DeviceEditor
          businessId={context.business.id}
          device={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setMessage("Đã lưu thiết bị GPS.")}
        />
      )}
    </>
  );
}
