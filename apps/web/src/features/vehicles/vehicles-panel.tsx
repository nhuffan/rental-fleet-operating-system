"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Me } from "@rental-fleet/contracts";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { Icon } from "@/components/ui/icon";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import type { Vehicle, VehiclePage } from "./types";
import { queryString, type VehicleFilters } from "./query";
import { FleetStatus } from "./fleet-status";
import { ListFilters } from "./list-filters";
import { VehicleEditor } from "./vehicle-editor";
export function VehiclesPanel({
  initial,
  context,
  branches,
  filters,
}: {
  initial: VehiclePage;
  context: Me;
  branches: Branch[];
  filters: VehicleFilters;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const editable = context.permissions.includes("vehicle.manage");
  const branchNames = new Map(
    branches.map((branch) => [branch.id, branch.name]),
  );
  const navigate = (values: Record<string, string | number>) =>
    startTransition(() => router.push(`/app/vehicles?${queryString(values)}`));
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title="Danh sách xe"
          subtitle={`${initial.total} xe phù hợp bộ lọc`}
          icon="car"
          action={
            editable && (
              <Button onClick={() => setEditing("new")}>
                <Icon name="plus" size={15} />
                Thêm xe
              </Button>
            )
          }
        />
        <ListFilters
          kind="vehicles"
          filters={filters}
          branches={branches}
          pending={pending}
          onApply={navigate}
        />
        <div aria-busy={pending}>
          <DataTable
            caption="Danh sách xe trong doanh nghiệp"
            rows={initial.data}
            columns={[
              {
                key: "plate",
                label: "Biển số",
                render: (vehicle) => (
                  <Link
                    className="fleet-record-link"
                    href={`/app/vehicles/${vehicle.id}`}
                  >
                    <strong>{vehicle.licensePlate}</strong>
                  </Link>
                ),
              },
              {
                key: "model",
                label: "Xe",
                render: (vehicle) => (
                  <span>
                    {vehicle.make} {vehicle.model}
                  </span>
                ),
              },
              {
                key: "branch",
                label: "Chi nhánh",
                render: (vehicle) =>
                  vehicle.branchId
                    ? (branchNames.get(vehicle.branchId) ??
                      "Chi nhánh không khả dụng")
                    : "Chưa phân chi nhánh",
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (vehicle) => <FleetStatus status={vehicle.status} />,
              },
              {
                key: "device",
                label: "Thiết bị đã gắn",
                render: (vehicle) =>
                  vehicle.currentAssignment ? (
                    <span>
                      {vehicle.currentAssignment.device.label ||
                        vehicle.currentAssignment.device.deviceUid}
                      <small className="fleet-cell-meta">
                        {vehicle.currentAssignment.device.provider}
                      </small>
                    </span>
                  ) : (
                    "Chưa gắn thiết bị"
                  ),
              },
              {
                key: "actions",
                label: "Thao tác",
                render: (vehicle) => (
                  <div className="inline">
                    <Link
                      className="button button-secondary"
                      href={`/app/vehicles/${vehicle.id}`}
                    >
                      Chi tiết
                    </Link>
                    {editable && (
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(vehicle)}
                      >
                        Chỉnh sửa
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            {...initial}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
      {editing && (
        <VehicleEditor
          businessId={context.business.id}
          vehicle={editing === "new" ? null : editing}
          branches={branches}
          onClose={() => setEditing(null)}
          onSaved={() => setMessage("Đã lưu thông tin xe.")}
        />
      )}
    </>
  );
}
