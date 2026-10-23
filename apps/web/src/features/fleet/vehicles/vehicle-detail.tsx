"use client";
import { VehicleRentalPanel } from "@/features/rentals/vehicle-rental-panel";
import type { VehicleRentalState } from "@/features/rentals/types";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Me } from "@rental-fleet/contracts";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { FleetStatus } from "./fleet-status";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { VehicleEditor } from "./vehicle-editor";
import { AssignmentEditor } from "./assignment-editor";
import { formatDate } from "@/lib/query";
import type { DeviceAssignmentPage, Vehicle } from "./types";
export function VehicleDetail({
  vehicle,
  history,
  branches,
  context,
  rentalState,
}: {
  vehicle: Vehicle;
  history: DeviceAssignmentPage;
  branches: Branch[];
  context: Me;
  rentalState: VehicleRentalState | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<"vehicle" | "assign" | "end" | null>(
    null,
  );
  const canEdit = context.permissions.includes("vehicle.manage");
  const canAssign = canEdit && context.permissions.includes("gps.read");
  const current = vehicle.currentAssignment;
  const branch = branches.find((item) => item.id === vehicle.branchId);
  return (
    <>
      <MutationNotice error="" message={message} />
      {context.permissions.includes("trip.read") && (
        <div className="rental-form-actions">
          <Link
            className="button button-secondary"
            href={`/app/trips?vehicleId=${vehicle.id}`}
          >
            Xem lịch sử hành trình của xe
          </Link>
        </div>
      )}
      {context.permissions.includes("commercial.read") && (
        <Panel>
          <PanelHeader
            title="Thu chi theo xe"
            subtitle="Doanh thu ghi nhận, chi phí vận hành và lợi nhuận ước tính từ giao dịch thực tế"
            icon="wallet"
            action={
              <Link
                className="button button-secondary"
                href={`/app/commercial?vehicleId=${vehicle.id}`}
              >
                Xem sổ giao dịch của xe
              </Link>
            }
          />
          <p className="panel-body quiet">
            Sổ giao dịch áp dụng bộ lọc xe này. Cọc đang giữ được tách khỏi
            doanh thu; phí đường bộ được nhập thủ công, chưa kết nối VETC.
          </p>
        </Panel>
      )}
      <div className="fleet-profile-grid">
        <Panel>
          <PanelHeader
            title="Hồ sơ xe"
            icon="car"
            action={
              canEdit && (
                <Button
                  variant="secondary"
                  onClick={() => setEditor("vehicle")}
                >
                  Chỉnh sửa
                </Button>
              )
            }
          />
          <dl className="detail-list">
            <div>
              <dt>Biển số</dt>
              <dd>{vehicle.licensePlate}</dd>
            </div>
            <div>
              <dt>Hãng / mẫu xe</dt>
              <dd>
                {vehicle.make} {vehicle.model}
              </dd>
            </div>
            <div>
              <dt>Chi nhánh</dt>
              <dd>
                {branch?.name ??
                  (vehicle.branchId
                    ? "Chi nhánh không khả dụng"
                    : "Chưa phân chi nhánh")}
              </dd>
            </div>
            <div>
              <dt>Trạng thái vòng đời</dt>
              <dd>
                <FleetStatus status={vehicle.status} />
              </dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{formatDate(vehicle.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật gần nhất</dt>
              <dd>{formatDate(vehicle.updatedAt)}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader
            title="Thiết bị đã gắn"
            icon="signal"
            action={
              canAssign &&
              (current ? (
                <Button variant="secondary" onClick={() => setEditor("end")}>
                  Tháo thiết bị
                </Button>
              ) : (
                <Button
                  disabled={vehicle.status !== "ACTIVE"}
                  title={
                    vehicle.status !== "ACTIVE"
                      ? "Kích hoạt xe trước khi gắn thiết bị"
                      : undefined
                  }
                  onClick={() => setEditor("assign")}
                >
                  Gắn thiết bị
                </Button>
              ))
            }
          />
          {current ? (
            <dl className="detail-list">
              <div>
                <dt>Nhãn thiết bị</dt>
                <dd>{current.device.label || "Chưa đặt nhãn"}</dd>
              </div>
              <div>
                <dt>UID thiết bị</dt>
                <dd>{current.device.deviceUid}</dd>
              </div>
              <div>
                <dt>Nhà cung cấp</dt>
                <dd>{current.device.provider}</dd>
              </div>
              <div>
                <dt>Gắn từ</dt>
                <dd>{formatDate(current.assignedAt)}</dd>
              </div>
              <div>
                <dt>Đăng ký thiết bị</dt>
                <dd>
                  <FleetStatus status={current.device.status} />
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              title="Chưa gắn thiết bị"
              description={
                vehicle.status === "ACTIVE"
                  ? "Gắn một thiết bị đã đăng ký để quản lý lịch sử liên kết với xe."
                  : "Xe đang ngưng hoạt động. Kích hoạt xe trước khi gắn thiết bị."
              }
              icon="signal"
            />
          )}
          <p className="quiet fleet-device-note">
            Mỗi xe có tối đa một thiết bị đang gắn. Trạng thái đăng ký thiết bị
            tách biệt với tín hiệu GPS; xem thời gian bản tin trong phần vị trí
            gần nhất.
          </p>
        </Panel>
      </div>
      {rentalState && <VehicleRentalPanel rentalState={rentalState} />}
      <Panel>
        <PanelHeader
          title="Lịch sử gắn thiết bị"
          subtitle={`${history.total} lần gắn · Thời gian theo giờ Việt Nam`}
          icon="audit"
        />
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
          <DataTable
            caption="Lịch sử gắn thiết bị của xe"
            rows={history.data}
            columns={[
              {
                key: "device",
                label: "Thiết bị",
                render: (assignment) => (
                  <span>
                    <strong>
                      {assignment.device.label || assignment.device.deviceUid}
                    </strong>
                    <small className="fleet-cell-meta">
                      {assignment.device.deviceUid}
                    </small>
                  </span>
                ),
              },
              {
                key: "provider",
                label: "Nhà cung cấp",
                render: (assignment) => assignment.device.provider,
              },
              {
                key: "start",
                label: "Gắn từ",
                render: (assignment) => formatDate(assignment.assignedAt),
              },
              {
                key: "end",
                label: "Tháo lúc",
                render: (assignment) =>
                  assignment.unassignedAt
                    ? formatDate(assignment.unassignedAt)
                    : "—",
              },
              {
                key: "status",
                label: "Liên kết",
                render: (assignment) => (
                  <Badge tone={assignment.unassignedAt ? "neutral" : "brand"}>
                    {assignment.unassignedAt ? "Đã kết thúc" : "Đang gắn"}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination
            disabled={pending}
            {...history}
            onPage={(page) =>
              startTransition(() =>
                router.push(`/app/vehicles/${vehicle.id}?page=${page}`, {
                  scroll: false,
                }),
              )
            }
          />
        </div>
      </Panel>
      {editor === "vehicle" && (
        <VehicleEditor
          businessId={context.business.id}
          vehicle={vehicle}
          branches={branches}
          onClose={() => setEditor(null)}
          onSaved={() => setMessage("Đã lưu thông tin xe.")}
        />
      )}
      {editor === "assign" && (
        <AssignmentEditor
          businessId={context.business.id}
          vehicle={vehicle}
          onClose={() => setEditor(null)}
          onSaved={() => setMessage("Đã gắn thiết bị vào xe.")}
        />
      )}
      {editor === "end" && current && (
        <AssignmentEditor
          businessId={context.business.id}
          vehicle={vehicle}
          ending={current}
          onClose={() => setEditor(null)}
          onSaved={() => setMessage("Đã tháo thiết bị; lịch sử được giữ lại.")}
        />
      )}
    </>
  );
}
