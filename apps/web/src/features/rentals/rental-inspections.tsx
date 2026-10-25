import Link from "next/link";
import { EvidenceGallery } from "./evidence/evidence-gallery";
import { RentalEvidenceHoldControl } from "./evidence/retention-controls";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import {
  conditionLabels,
  inspectionItems,
  inspectionStatus,
} from "./inspection-fields";
import type { RentalInspection } from "./types";

function ChecklistStatus({ value }: { value: RentalInspection["spareTire"] }) {
  return (
    <Badge
      tone={
        value === "MISSING"
          ? "warning"
          : value === "PRESENT"
            ? "success"
            : "neutral"
      }
    >
      {inspectionStatus(value)}
    </Badge>
  );
}
export function InspectionSnapshot({
  inspection,
}: {
  inspection: RentalInspection;
}) {
  return (
    <>
      <dl className="detail-list inspection-summary">
        <div>
          <dt>Odometer</dt>
          <dd>{inspection.odometer.toLocaleString("vi-VN")} km</dd>
        </div>
        <div>
          <dt>Mức nhiên liệu</dt>
          <dd>{inspection.fuelPercent}%</dd>
        </div>
        <div>
          <dt>Ngoại thất</dt>
          <dd>
            <Badge
              tone={
                inspection.exteriorCondition === "DAMAGED"
                  ? "warning"
                  : "success"
              }
            >
              {conditionLabels[inspection.exteriorCondition]}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Nội thất</dt>
          <dd>
            <Badge
              tone={
                inspection.interiorCondition === "DAMAGED"
                  ? "warning"
                  : "success"
              }
            >
              {conditionLabels[inspection.interiorCondition]}
            </Badge>
          </dd>
        </div>
        {inspectionItems.map(({ name, label }) => (
          <div key={name}>
            <dt>{label}</dt>
            <dd>
              <ChecklistStatus value={inspection[name]} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="inspection-notes">
        <div>
          <h3>Hư hỏng đã ghi nhận</h3>
          <p>{inspection.damageNotes || "Không có ghi chú hư hỏng."}</p>
        </div>
        <div>
          <h3>Ghi chú khác</h3>
          <p>{inspection.notes || "Không có ghi chú."}</p>
        </div>
      </div>
      <dl className="detail-list inspection-recorded">
        <div>
          <dt>Ghi nhận lúc (VN)</dt>
          <dd>{formatDate(inspection.recordedAt)}</dd>
        </div>
        <div>
          <dt>Người lập (ID)</dt>
          <dd className="inspection-reference">{inspection.actorId}</dd>
        </div>
      </dl>
    </>
  );
}
function SignedNumber({ value, unit }: { value: number; unit: string }) {
  return (
    <>
      {value > 0 ? "+" : ""}
      {value.toLocaleString("vi-VN")} {unit}
    </>
  );
}
export function RentalInspections({
  inspections,
  rentalId,
  businessId,
}: {
  inspections: RentalInspection[];
  rentalId: string;
  businessId: string;
}) {
  const handover = inspections.find((item) => item.type === "HANDOVER");
  const returned = inspections.find((item) => item.type === "RETURN");
  const changes =
    handover && returned
      ? [
          ...(["exteriorCondition", "interiorCondition"] as const)
            .filter((name) => handover[name] !== returned[name])
            .map((name) => ({
              name,
              label: name === "exteriorCondition" ? "Ngoại thất" : "Nội thất",
              before: conditionLabels[handover[name]],
              after: conditionLabels[returned[name]],
            })),
          ...inspectionItems
            .filter(({ name }) => handover[name] !== returned[name])
            .map(({ name, label }) => ({
              name,
              label,
              before: inspectionStatus(handover[name]),
              after: inspectionStatus(returned[name]),
            })),
        ]
      : [];
  return (
    <section className="rental-inspections" aria-label="Biên bản kiểm tra xe">
      <RentalEvidenceHoldControl rentalId={rentalId} businessId={businessId} />
      <div className="rental-detail-grid">
        {[
          { title: "Biên bản bàn giao", inspection: handover },
          { title: "Biên bản nhận trả", inspection: returned },
        ].map(({ title, inspection }) => (
          <Panel key={title}>
            <PanelHeader
              title={title}
              icon="rental"
              subtitle={
                inspection ? "Biên bản đã lưu · Không thể chỉnh sửa" : undefined
              }
            />
            {inspection ? (
              <>
                <InspectionSnapshot inspection={inspection} />
                <EvidenceGallery
                  rentalId={rentalId}
                  businessId={businessId}
                  type={inspection.type}
                />
              </>
            ) : (
              <EmptyState
                title="Chưa có biên bản"
                description="Biên bản được lưu khi thực hiện bàn giao hoặc nhận trả xe. Các hợp đồng trước đây có thể chưa có bản ghi kiểm tra."
                icon="rental"
              />
            )}
          </Panel>
        ))}
      </div>
      {handover && returned && (
        <Panel>
          <PanelHeader
            title="Đối chiếu bàn giao & nhận trả"
            icon="audit"
            subtitle="Thông tin kiểm tra thực tế; không tự tính phí hay trừ cọc"
          />
          <div className="inspection-comparison">
            <dl className="inspection-deltas">
              <div>
                <dt>Quãng đường theo odometer</dt>
                <dd>
                  <SignedNumber
                    value={returned.odometer - handover.odometer}
                    unit="km"
                  />
                </dd>
              </div>
              <div>
                <dt>Chênh lệch nhiên liệu</dt>
                <dd>
                  <SignedNumber
                    value={returned.fuelPercent - handover.fuelPercent}
                    unit="điểm %"
                  />
                </dd>
              </div>
            </dl>
            {changes.length ? (
              <ul className="inspection-changes">
                {changes.map(({ name, label, before, after }) => (
                  <li key={name}>
                    <strong>{label}</strong>
                    <span>Bàn giao: {before}</span>
                    <span>Nhận trả: {after}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet">
                Tình trạng ngoại thất, nội thất và checklist không thay đổi.
              </p>
            )}
            <div className="inspection-damage-comparison">
              <h3>Đối chiếu ghi chú hư hỏng</h3>
              <dl>
                <div>
                  <dt>Bàn giao</dt>
                  <dd>{handover.damageNotes || "Không có ghi chú hư hỏng."}</dd>
                </div>
                <div>
                  <dt>Nhận trả</dt>
                  <dd>{returned.damageNotes || "Không có ghi chú hư hỏng."}</dd>
                </div>
              </dl>
            </div>
            <p className="quiet">
              Chênh lệch chỉ để đối chiếu hai mốc kiểm tra, không kết luận tự
              động về trách nhiệm hư hỏng. Mọi khoản thu hoặc chi cần được ghi
              nhận riêng tại phần Thu chi.
            </p>
          </div>
        </Panel>
      )}
    </section>
  );
}
export function VehicleInspectionPanel({
  inspection,
  canReadRental,
}: {
  inspection: RentalInspection | null;
  canReadRental: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Biên bản kiểm tra gần nhất"
        icon="rental"
        subtitle={
          inspection
            ? inspection.type === "HANDOVER"
              ? "Bàn giao xe"
              : "Nhận trả xe"
            : undefined
        }
        action={
          inspection && canReadRental ? (
            <Link
              className="button button-secondary"
              href={`/app/rentals/${inspection.rentalId}#rental-inspections`}
            >
              Xem hợp đồng liên quan
            </Link>
          ) : undefined
        }
      />
      {inspection ? (
        <InspectionSnapshot inspection={inspection} />
      ) : (
        <EmptyState
          title="Chưa có biên bản"
          description="Biên bản gần nhất sẽ xuất hiện sau khi bàn giao hoặc nhận trả xe kèm kiểm tra."
          icon="rental"
        />
      )}
    </Panel>
  );
}
