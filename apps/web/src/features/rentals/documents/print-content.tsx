import type { ReactNode } from "react";
import type { Business } from "@rental-fleet/contracts";
import type { ContractDocument, Rental, RentalInspection } from "../types";
import {
  documentDate,
  documentMoney,
  documentText,
  vndInWords,
  wholeVnd,
} from "./presentation";

function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="print-fields">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Signatures({
  businessName,
  customerName,
}: {
  businessName: string;
  customerName: string;
}) {
  return (
    <section className="print-signatures">
      <p>Địa điểm ký: …………………………………… · Ngày …… tháng …… năm …………</p>
      <div>
        <section>
          <strong>ĐẠI DIỆN BÊN CHO THUÊ</strong>
          <small>(Ký, ghi rõ họ tên)</small>
          <span>{documentText(businessName)}</span>
        </section>
        <section>
          <strong>BÊN THUÊ / NHẬN XE</strong>
          <small>(Ký, ghi rõ họ tên)</small>
          <span>{documentText(customerName)}</span>
        </section>
      </div>
    </section>
  );
}
export function ContractPrint({ document }: { document: ContractDocument }) {
  const { business, customer, vehicle, rental, pricing, terms } =
    document.snapshot;
  const showMoney = (value: string) =>
    business.currency === "VND" && wholeVnd(value) !== null
      ? documentMoney(value)
      : `${value} ${business.currency}`;
  const showWords = (value: string) =>
    business.currency === "VND"
      ? vndInWords(value)
      : "Chưa hỗ trợ đơn vị tiền tệ này";
  return (
    <article className="print-document">
      <header className="print-document-heading">
        <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <strong>Độc lập – Tự do – Hạnh phúc</strong>
        <h1>HỢP ĐỒNG THUÊ XE</h1>
        <p>
          Số: {document.docNumber} · Phiên bản {document.version}
        </p>
        <p>
          Ngày phát hành: {documentDate(document.issuedAt, business.timezone)}
        </p>
      </header>
      <section>
        <h2>1. Bên cho thuê</h2>
        <Fields
          rows={[
            ["Tên pháp lý", documentText(business.legalName)],
            ["Tên doanh nghiệp", documentText(business.name)],
            ["Địa chỉ", documentText(business.address)],
            ["Điện thoại", documentText(business.phone)],
            ["Mã số thuế", documentText(business.taxCode)],
            ["Người đại diện", documentText(business.representativeName)],
            ["Chức danh", documentText(business.representativeTitle)],
          ]}
        />
      </section>
      <section>
        <h2>2. Bên thuê</h2>
        <Fields
          rows={[
            ["Họ tên", documentText(customer.name)],
            ["CCCD / Giấy tờ định danh", documentText(customer.idNumber)],
            ["Địa chỉ", documentText(customer.address)],
            ["Điện thoại", documentText(customer.phone)],
            ["Email", documentText(customer.email)],
            ["Số GPLX", documentText(customer.driverLicenseNumber)],
            ["Hạng GPLX", documentText(customer.driverLicenseClass)],
          ]}
        />
      </section>
      <section>
        <h2>3. Xe và thời hạn thuê</h2>
        <Fields
          rows={[
            ["Biển số", vehicle.licensePlate],
            ["Nhãn hiệu / Dòng xe", `${vehicle.make} ${vehicle.model}`],
            [
              "Nhận xe dự kiến",
              documentDate(rental.startAt, business.timezone),
            ],
            ["Trả xe dự kiến", documentDate(rental.endAt, business.timezone)],
            ["Múi giờ", business.timezone],
          ]}
        />
      </section>
      <section>
        <h2>4. Giá thuê và đặt cọc</h2>
        <Fields
          rows={[
            ["Giá thuê thỏa thuận", showMoney(rental.rentalAmount)],
            ["Bằng chữ", showWords(rental.rentalAmount)],
            ["Tiền cọc yêu cầu", showMoney(rental.depositRequiredAmount)],
            ["Cọc bằng chữ", showWords(rental.depositRequiredAmount)],
            [
              "Xác nhận cọc trên hợp đồng",
              rental.depositReceived ? "Đã xác nhận" : "Chưa xác nhận",
            ],
          ]}
        />
        <p>
          Giá và xác nhận cọc trên hợp đồng là điều khoản thỏa thuận; các khoản
          tiền thực thu/hoàn trả được ghi nhận bằng chứng từ riêng.
        </p>
        {pricing && (
          <div className="print-pricing">
            <p>
              Nguồn giá:{" "}
              {pricing.mode === "CALCULATED"
                ? "Theo bảng giá"
                : pricing.mode === "OVERRIDE"
                  ? "Giá thỏa thuận thay thế bảng giá"
                  : "Giá thỏa thuận thủ công"}
              .
            </p>
            {pricing.breakdown && (
              <>
                <p>
                  Bảng giá: {pricing.breakdown.rateName} · phiên bản{" "}
                  {pricing.breakdown.rateVersion} ·{" "}
                  {pricing.breakdown.rateSource === "VEHICLE"
                    ? "riêng xe"
                    : "mặc định doanh nghiệp"}
                  .
                </p>
                <ul>
                  {pricing.breakdown.lines.map((line, index) => (
                    <li key={index}>
                      {line.kind === "MINIMUM"
                        ? "Điều chỉnh mức tối thiểu"
                        : `${line.units} ${line.kind === "HOUR" || line.kind === "EXTRA_HOUR" ? "giờ" : "ngày"} × ${documentMoney(line.unitPrice)}`}{" "}
                      = {documentMoney(line.amount)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {pricing.overrideReason && (
              <p>Lý do thỏa thuận: {pricing.overrideReason}</p>
            )}
          </div>
        )}
      </section>
      <section>
        <h2>5. Điều khoản thỏa thuận</h2>
        <div className="print-terms">{terms}</div>
      </section>
      {rental.notes && (
        <section>
          <h2>Ghi chú bổ sung</h2>
          <p className="print-preserve">{rental.notes}</p>
        </section>
      )}
      <Signatures
        businessName={business.representativeName}
        customerName={customer.name}
      />
    </article>
  );
}
const checkLabels = {
  PRESENT: "Có",
  MISSING: "Thiếu",
  NOT_APPLICABLE: "Không áp dụng",
};
export function InspectionPrint({
  rental,
  inspection,
  handover,
  business,
}: {
  rental: Rental;
  inspection: RentalInspection;
  handover: RentalInspection | null;
  business: Business;
}) {
  const returning = inspection.type === "RETURN";
  return (
    <article className="print-document">
      <header className="print-document-heading">
        <h1>{returning ? "BIÊN BẢN TRẢ XE" : "BIÊN BẢN BÀN GIAO XE"}</h1>
        <p>Hợp đồng: {rental.id}</p>
        <p>
          Thời điểm ghi nhận:{" "}
          {documentDate(inspection.recordedAt, business.timezone)}
        </p>
      </header>
      <section>
        <h2>Thông tin giao nhận</h2>
        <Fields
          rows={[
            ["Bên cho thuê", documentText(business.legalName || business.name)],
            ["Địa chỉ", documentText(business.address)],
            ["Điện thoại doanh nghiệp", documentText(business.phone)],
            ["Khách thuê", documentText(rental.customer.name)],
            [
              "Liên hệ khách thuê",
              documentText(
                [rental.customer.phone, rental.customer.email]
                  .filter(Boolean)
                  .join(" · "),
              ),
            ],
            ["Biển số xe", rental.vehicle.licensePlate],
            [
              "Nhãn hiệu / Dòng xe",
              `${rental.vehicle.make} ${rental.vehicle.model}`,
            ],
          ]}
        />
      </section>
      <section>
        <h2>Tình trạng xe đã ghi nhận</h2>
        <Fields
          rows={[
            ["Odometer", `${inspection.odometer.toLocaleString("vi-VN")} km`],
            ["Nhiên liệu", `${inspection.fuelPercent}%`],
            [
              "Ngoại thất",
              inspection.exteriorCondition === "GOOD" ? "Tốt" : "Có hư hỏng",
            ],
            [
              "Nội thất",
              inspection.interiorCondition === "GOOD" ? "Tốt" : "Có hư hỏng",
            ],
            ["Lốp dự phòng", checkLabels[inspection.spareTire]],
            ["Dụng cụ theo xe", checkLabels[inspection.tools]],
            ["Đăng ký xe", checkLabels[inspection.registrationDocument]],
            ["Giấy bảo hiểm", checkLabels[inspection.insuranceDocument]],
            ["Chìa khóa", checkLabels[inspection.keys]],
          ]}
        />
      </section>
      {returning && (
        <section>
          <h2>Đối chiếu bàn giao và trả xe</h2>
          {handover ? (
            <Fields
              rows={[
                [
                  "Odometer khi bàn giao",
                  `${handover.odometer.toLocaleString("vi-VN")} km`,
                ],
                [
                  "Km đã đi",
                  `${(inspection.odometer - handover.odometer).toLocaleString("vi-VN")} km`,
                ],
                ["Nhiên liệu khi bàn giao", `${handover.fuelPercent}%`],
                [
                  "Chênh lệch nhiên liệu",
                  `${inspection.fuelPercent - handover.fuelPercent > 0 ? "+" : ""}${inspection.fuelPercent - handover.fuelPercent} điểm phần trăm`,
                ],
              ]}
            />
          ) : (
            <p>Chưa có biên bản bàn giao để đối chiếu số đo.</p>
          )}
          <p>
            Chênh lệch chỉ mô tả số liệu đã lưu, không xác định khoản phí hoặc
            khấu trừ cọc.
          </p>
        </section>
      )}
      <section>
        <h2>Hư hại và ghi chú</h2>
        <p className="print-preserve">
          <strong>Hư hại:</strong> {documentText(inspection.damageNotes)}
        </p>
        <p className="print-preserve">
          <strong>Ghi chú:</strong> {documentText(inspection.notes)}
        </p>
        <p>Ảnh/video lưu trên hệ thống.</p>
      </section>
      <Signatures
        businessName={business.representativeName}
        customerName={rental.customer.name}
      />
    </article>
  );
}
