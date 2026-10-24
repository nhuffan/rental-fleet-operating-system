"use client";
import { useState } from "react";
import {
  PageHeader,
  Panel,
  PanelHeader,
  Badge,
  Button,
} from "@/components/ui/primitives";
import { MetricCard } from "@/components/data-display/metric-card";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import {
  DataTable,
  SearchInput,
  Pagination,
} from "@/components/data-display/table";
import { FleetMap } from "./fleet-map";
import { FleetSchedule } from "./fleet-schedule";
import { ActiveRentalQueue } from "./active-rental-queue";
import {
  VehicleBadge,
  GPSBadge,
  RentalBadge,
  CarIllustration,
} from "./fleet-visuals";
import {
  vehicles,
  rentals,
  vehicleFor,
  vehicleLabels,
  isOverdue,
  money,
  formatDate,
  type Vehicle,
  type Rental,
} from "./fixtures";
type Detail =
  | { kind: "vehicle"; value: Vehicle }
  | { kind: "rental"; value: Rental }
  | { kind: "customer"; value: string }
  | { kind: "trip"; value: string }
  | { kind: "wizard" };
const titles: Record<string, [string, string]> = {
  dashboard: [
    "Tổng quan vận hành",
    "Góc nhìn toàn cảnh đội xe, lịch thuê và công việc hôm nay.",
  ],
  vehicles: ["Đội xe", "Danh sách phương tiện và trạng thái vận hành."],
  rentals: [
    "Hợp đồng thuê",
    "Theo dõi lịch đặt, hợp đồng đang thuê và hạn trả xe.",
  ],
  customers: [
    "Khách hàng",
    "Thông tin liên hệ và lịch sử thuê trong doanh nghiệp.",
  ],
  "fleet-map": [
    "Bản đồ đội xe",
    "Vị trí được biết gần nhất và tình trạng tín hiệu từng xe.",
  ],
  trips: ["Hành trình", "Tổng quan chuyến đi và lộ trình minh họa."],
  commercial: [
    "Thương mại",
    "Tiền cọc, phí đường bộ và tín hiệu doanh thu theo hợp đồng.",
  ],
};
export function FleetPreview({ screen = "dashboard" }: { screen?: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(1);
  const [wizardVehicle, setWizardVehicle] = useState("v2");
  const openVehicle = (value: Vehicle) => setDetail({ kind: "vehicle", value });
  const openRental = (value: Rental) => setDetail({ kind: "rental", value });
  const [title, description] = titles[screen] ?? titles.dashboard;
  const metricData = [
    [
      "Sẵn sàng",
      vehicles.filter((v) => v.status === "AVAILABLE").length,
      "success",
      "car",
    ],
    [
      "Đang thuê",
      vehicles.filter((v) => v.status === "RENTED").length,
      "info",
      "rental",
    ],
    [
      "Đã đặt",
      vehicles.filter((v) => v.status === "RESERVED").length,
      "brand",
      "calendar",
    ],
    ["Quá hạn", rentals.filter(isOverdue).length, "danger", "clock"],
  ] as const;
  let body;
  if (screen === "dashboard")
    body = (
      <div className="dashboard-grid">
        <Panel className="dashboard-map">
          <PanelHeader
            title="Bản đồ đội xe"
            subtitle={`${vehicles.length} phương tiện · Vị trí minh họa gần nhất`}
            icon="map"
            action={<Badge tone="neutral">Sơ đồ demo</Badge>}
          />
          <FleetMap onVehicle={openVehicle} />
        </Panel>
        <div className="stats-grid">
          {metricData.map(([label, value, tone, icon]) => (
            <MetricCard
              key={label}
              label={label}
              value={String(value).padStart(2, "0")}
              tone={tone}
              icon={icon}
              description="Dữ liệu minh họa"
            />
          ))}
        </div>
        <FleetSchedule onRental={openRental} />
        <ActiveRentalQueue onRental={openRental} />
      </div>
    );
  else if (screen === "fleet-map")
    body = (
      <Panel>
        <PanelHeader
          icon="map"
          title="Bản đồ & vị trí cuối"
          subtitle="Sơ đồ không theo tỷ lệ · Chưa kết nối nhà cung cấp GPS"
        />
        <FleetMap expanded onVehicle={openVehicle} />
      </Panel>
    );
  else if (screen === "vehicles") {
    const filtered = vehicles.filter(
      (v) =>
        `${v.model} ${v.plate}`.toLowerCase().includes(query.toLowerCase()) &&
        (status === "ALL" || status === v.status),
    );
    body = (
      <Panel>
        <PanelHeader
          title="Danh sách phương tiện"
          subtitle={`${vehicles.length} phương tiện minh họa`}
          icon="car"
          action={
            <Button disabled title="Chờ Fleet API">
              Thêm xe · Sắp có
            </Button>
          }
        />
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Tìm biển số, tên xe…"
          />
          <select
            className="filter-select"
            aria-label="Lọc trạng thái xe"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(vehicleLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          rows={filtered.slice((page - 1) * 5, page * 5)}
          caption="Xe minh họa"
          columns={[
            {
              key: "vehicle",
              label: "Phương tiện",
              render: (v) => (
                <div className="inline">
                  <CarIllustration vehicle={v} />
                  <div>
                    <strong>{v.model}</strong>
                    <small>
                      {v.plate} · {v.type}
                    </small>
                  </div>
                </div>
              ),
            },
            { key: "branch", label: "Chi nhánh", render: (v) => v.branch },
            {
              key: "status",
              label: "Vận hành",
              render: (v) => <VehicleBadge vehicle={v} />,
            },
            {
              key: "gps",
              label: "GPS · Mốc 22/10/2026",
              render: (v) => (
                <>
                  <GPSBadge vehicle={v} />
                  <small>{formatDate(v.lastSeen)} UTC+7</small>
                </>
              ),
            },
            {
              key: "detail",
              label: "Chi tiết",
              render: (v) => (
                <Button variant="secondary" onClick={() => openVehicle(v)}>
                  Xem chi tiết
                </Button>
              ),
            },
          ]}
        />
        <Pagination
          page={page}
          limit={5}
          total={filtered.length}
          onPage={setPage}
        />
      </Panel>
    );
  } else if (screen === "rentals") {
    const filtered = rentals.filter(
      (r) =>
        `${r.id} ${r.customer} ${vehicleFor(r.vehicleId).plate}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "ALL" ||
          (status === "OVERDUE" && isOverdue(r)) ||
          status === r.status),
    );
    body = (
      <Panel>
        <PanelHeader
          title="Danh sách hợp đồng"
          subtitle="Vòng đời minh họa · Chưa có thao tác ghi"
          icon="rental"
          action={
            <Button
              onClick={() => {
                setStep(1);
                setDetail({ kind: "wizard" });
              }}
            >
              <Icon name="plus" size={14} />
              Xem quy trình tạo
            </Button>
          }
        />
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          <select
            className="filter-select"
            aria-label="Lọc hợp đồng"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang thuê</option>
            <option value="RESERVED">Đã đặt</option>
            <option value="OVERDUE">Quá hạn</option>
          </select>
        </div>
        <DataTable
          rows={filtered}
          caption="Hợp đồng minh họa"
          columns={[
            {
              key: "id",
              label: "Hợp đồng",
              render: (r) => <strong>{r.id}</strong>,
            },
            {
              key: "vehicle",
              label: "Phương tiện",
              render: (r) => (
                <>
                  {vehicleFor(r.vehicleId).model}
                  <small>{vehicleFor(r.vehicleId).plate}</small>
                </>
              ),
            },
            { key: "customer", label: "Khách thuê", render: (r) => r.customer },
            {
              key: "range",
              label: "Thời gian · UTC+7",
              render: (r) => (
                <>
                  {formatDate(r.start)}
                  <small>→ {formatDate(r.end)}</small>
                </>
              ),
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (r) => <RentalBadge rental={r} />,
            },
            {
              key: "detail",
              label: "Chi tiết",
              render: (r) => (
                <Button variant="secondary" onClick={() => openRental(r)}>
                  Xem hợp đồng
                </Button>
              ),
            },
          ]}
        />
      </Panel>
    );
  } else if (screen === "customers")
    body = (
      <Panel>
        <PanelHeader
          icon="users"
          title="Khách hàng doanh nghiệp"
          subtitle="Danh tính tổng hợp dùng cho thiết kế"
          action={<Button disabled>Thêm khách · Sắp có</Button>}
        />
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          <Badge tone="neutral">5 hồ sơ minh họa</Badge>
        </div>
        <DataTable
          rows={rentals.filter((r) =>
            r.customer.toLowerCase().includes(query.toLowerCase()),
          )}
          caption="Khách hàng minh họa"
          columns={[
            {
              key: "name",
              label: "Khách hàng",
              render: (r) => (
                <div className="inline">
                  <span className="avatar">{r.customer.slice(-1)}</span>
                  <strong>{r.customer}</strong>
                </div>
              ),
            },
            {
              key: "contact",
              label: "Liên hệ",
              render: () => "Không có dữ liệu liên hệ",
            },
            {
              key: "rentals",
              label: "Lịch sử thuê",
              render: () => "1 hợp đồng minh họa",
            },
            {
              key: "detail",
              label: "Chi tiết",
              render: (r) => (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setDetail({ kind: "customer", value: r.customer })
                  }
                >
                  Xem hồ sơ
                </Button>
              ),
            },
          ]}
        />
      </Panel>
    );
  else if (screen === "trips")
    body = (
      <div className="core-grid">
        <Panel>
          <PanelHeader
            title="Hành trình gần đây"
            subtitle="Không có dữ liệu vị trí thực tế"
            icon="trip"
          />
          <DataTable
            rows={rentals.filter((r) => r.status === "ACTIVE")}
            caption="Hành trình minh họa"
            columns={[
              {
                key: "id",
                label: "Hành trình",
                render: (r) => <strong>TR-{r.id.slice(-4)}</strong>,
              },
              {
                key: "vehicle",
                label: "Xe / Hợp đồng",
                render: (r) => (
                  <>
                    {vehicleFor(r.vehicleId).plate}
                    <small>{r.id}</small>
                  </>
                ),
              },
              {
                key: "distance",
                label: "Quãng đường demo",
                render: () => "28,4 km",
              },
              {
                key: "detail",
                label: "Lộ trình",
                render: (r) => (
                  <Button
                    variant="secondary"
                    onClick={() => setDetail({ kind: "trip", value: r.id })}
                  >
                    Xem lộ trình
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader
            title="Tình trạng kết nối"
            subtitle="Tách biệt với trạng thái hợp đồng"
            icon="signal"
          />
          <div className="panel-body">
            <p className="quiet">
              Vị trí cuối và thời gian nhận tín hiệu sẽ được lấy từ Telematics
              API. Sơ đồ thiết kế không cung cấp dẫn đường.
            </p>
            <Badge tone="warning">Chờ Trip / GPS API</Badge>
          </div>
        </Panel>
      </div>
    );
  else
    body = (
      <>
        <div className="core-stats">
          {[
            [
              "Tiền cọc theo hợp đồng",
              money(rentals.reduce((n, r) => n + r.deposit, 0)),
              "wallet",
            ],
            ["Phí đường bộ minh họa", money(85000), "trip"],
            ["Doanh thu", "Chưa có API", "rental"],
          ].map(([label, value, icon]) => (
            <Panel className="core-stat" key={label}>
              <span>
                <Icon name={icon as "wallet" | "trip" | "rental"} /> {label}
              </span>
              <strong style={{ fontSize: 23 }}>{value}</strong>
              <small className="quiet">Dữ liệu minh họa</small>
            </Panel>
          ))}
        </div>
        <Panel>
          <PanelHeader
            title="Tiền cọc & liên kết hợp đồng"
            subtitle="Theo dõi theo hợp đồng thuê, không phải sổ kế toán"
            icon="wallet"
          />
          <DataTable
            rows={rentals}
            caption="Tiền cọc minh họa"
            columns={[
              {
                key: "id",
                label: "Hợp đồng",
                render: (r) => <strong>{r.id}</strong>,
              },
              {
                key: "customer",
                label: "Khách thuê",
                render: (r) => r.customer,
              },
              {
                key: "deposit",
                label: "Tiền cọc minh họa",
                render: (r) => money(r.deposit),
              },
              {
                key: "toll",
                label: "Phí đường bộ / hành trình",
                render: (r) =>
                  r.id === "HD-1024"
                    ? "85.000 ₫ · TR-1024"
                    : "Chưa có phát sinh minh họa",
              },
              {
                key: "details",
                label: "Liên kết",
                render: (r) => (
                  <Button variant="secondary" onClick={() => openRental(r)}>
                    Xem hợp đồng
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        <div className="notice notice-info" style={{ marginTop: 16 }}>
          Chờ Deposit / Toll / Revenue API. Không hỗ trợ thu tiền, hoàn cọc hoặc
          báo cáo P&amp;L.
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <span className="date-chip">
            <Icon name="calendar" size={14} />
            22 tháng 10, 2026
          </span>
        }
      />
      {body}
      {detail && (
        <Drawer
          title={
            detail.kind === "vehicle"
              ? "Chi tiết phương tiện"
              : detail.kind === "rental"
                ? `Hợp đồng ${detail.value.id}`
                : detail.kind === "customer"
                  ? "Hồ sơ khách hàng"
                  : detail.kind === "trip"
                    ? "Chi tiết hành trình"
                    : "Quy trình tạo hợp đồng"
          }
          onClose={() => setDetail(null)}
        >
          <div className="drawer-preview-note">
            Dữ liệu minh họa · Không có thao tác ghi
          </div>
          {detail.kind === "vehicle" && (
            <>
              <div className="vehicle-hero">
                <CarIllustration large vehicle={detail.value} />
                <h2>{detail.value.model}</h2>
                <p>
                  {detail.value.plate} · {detail.value.type}
                </p>
                <div className="inline" style={{ justifyContent: "center" }}>
                  <VehicleBadge vehicle={detail.value} />
                  <GPSBadge vehicle={detail.value} />
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Chi nhánh</dt>
                  <dd>{detail.value.branch}</dd>
                </div>
                <div>
                  <dt>Tín hiệu cuối</dt>
                  <dd>{formatDate(detail.value.lastSeen)} UTC+7</dd>
                </div>
                <div>
                  <dt>Nguồn vị trí</dt>
                  <dd>Sơ đồ minh họa</dd>
                </div>
              </dl>
              <div className="panel-body">
                <h3>Hợp đồng liên quan</h3>
                {rentals
                  .filter((r) => r.vehicleId === detail.value.id)
                  .map((r) => (
                    <button
                      className="quick-link related-rental"
                      key={r.id}
                      onClick={() => openRental(r)}
                    >
                      <strong>{r.id}</strong>
                      <RentalBadge rental={r} />
                      <Icon name="arrow" />
                    </button>
                  ))}
                {!rentals.some((r) => r.vehicleId === detail.value.id) && (
                  <p className="quiet">
                    Chưa có hợp đồng trong dữ liệu minh họa.
                  </p>
                )}
              </div>
            </>
          )}
          {detail.kind === "rental" && (
            <>
              <div className="vehicle-hero">
                <CarIllustration
                  large
                  vehicle={vehicleFor(detail.value.vehicleId)}
                />
                <h2>{vehicleFor(detail.value.vehicleId).model}</h2>
                <p>{vehicleFor(detail.value.vehicleId).plate}</p>
                <RentalBadge rental={detail.value} />
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Khách thuê</dt>
                  <dd>{detail.value.customer}</dd>
                </div>
                <div>
                  <dt>Nhận xe</dt>
                  <dd>{formatDate(detail.value.start)} UTC+7</dd>
                </div>
                <div>
                  <dt>Hẹn trả</dt>
                  <dd>{formatDate(detail.value.end)} UTC+7</dd>
                </div>
                <div>
                  <dt>Tiền cọc minh họa</dt>
                  <dd>{money(detail.value.deposit)}</dd>
                </div>
              </dl>
              <div className="panel-body">
                <h3>Vòng đời hợp đồng</h3>
                <ol className="lifecycle">
                  <li className="done">Đã đặt</li>
                  <li
                    className={detail.value.status === "ACTIVE" ? "done" : ""}
                  >
                    Đã giao xe
                  </li>
                  <li>
                    Chờ nhận lại xe
                    {isOverdue(detail.value) && (
                      <Badge tone="danger">Quá hạn tại mốc minh họa</Badge>
                    )}
                  </li>
                  <li>Hoàn tất</li>
                </ol>
                <Button disabled>Thao tác hợp đồng · Sắp có</Button>
              </div>
            </>
          )}
          {detail.kind === "customer" && (
            <div className="panel-body">
              <h2>{detail.value}</h2>
              <p className="quiet">
                Hồ sơ tổng hợp. Không lưu thông tin định danh hoặc liên hệ thật.
              </p>
              <h3>Lịch sử thuê</h3>
              {rentals
                .filter((r) => r.customer === detail.value)
                .map((r) => (
                  <button
                    key={r.id}
                    className="quick-link related-rental"
                    onClick={() => openRental(r)}
                  >
                    <strong>{r.id}</strong>
                    <RentalBadge rental={r} />
                    <Icon name="arrow" />
                  </button>
                ))}
            </div>
          )}
          {detail.kind === "trip" && (
            <div className="panel-body">
              <Badge tone="warning">Lộ trình minh họa</Badge>
              <svg
                className="trip-schematic"
                viewBox="0 0 350 250"
                role="img"
                aria-label="Sơ đồ hành trình minh họa từ điểm A đến điểm B"
              >
                <rect width="350" height="250" fill="#edf1e9" rx="12" />
                <path
                  d="M35 200 90 160 140 180 170 80 230 110 310 45"
                  fill="none"
                  stroke="#e9702e"
                  strokeWidth="5"
                  strokeDasharray="8 4"
                />
                <circle cx="35" cy="200" r="8" fill="#24734e" />
                <circle cx="310" cy="45" r="8" fill="#e9702e" />
                <text x="45" y="224" fontSize="12">
                  Điểm A (demo)
                </text>
                <text x="210" y="30" fontSize="12">
                  Điểm B (demo)
                </text>
              </svg>
              <dl className="detail-list">
                <div>
                  <dt>Hợp đồng liên kết</dt>
                  <dd>{detail.value}</dd>
                </div>
                <div>
                  <dt>Quãng đường mẫu</dt>
                  <dd>28,4 km</dd>
                </div>
                <div>
                  <dt>Thời lượng mẫu</dt>
                  <dd>52 phút</dd>
                </div>
                <div>
                  <dt>Phí đường bộ mẫu</dt>
                  <dd>
                    {detail.value === "HD-1024"
                      ? money(85000)
                      : "Chưa có phát sinh minh họa"}
                  </dd>
                </div>
              </dl>
              <p className="quiet">
                Không phải lịch sử di chuyển thực tế. Chờ Trip API.
              </p>
            </div>
          )}
          {detail.kind === "wizard" && (
            <div className="panel-body">
              <div className="wizard-steps">
                {[1, 2, 3].map((s) => (
                  <span key={s} className={step === s ? "current" : ""}>
                    {s}.{" "}
                    {s === 1 ? "Chọn xe" : s === 2 ? "Thời gian" : "Xem lại"}
                  </span>
                ))}
              </div>
              {step === 1 ? (
                <label className="form-field">
                  Phương tiện minh họa
                  <select
                    value={wizardVehicle}
                    onChange={(e) => setWizardVehicle(e.target.value)}
                  >
                    {vehicles
                      .filter((v) => v.status === "AVAILABLE")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.model}
                        </option>
                      ))}
                  </select>
                </label>
              ) : step === 2 ? (
                <>
                  <p className="quiet">
                    Khoảng thuê cố định để minh họa. Chưa hỗ trợ kiểm tra trùng
                    lịch từ API.
                  </p>
                  <dl className="detail-list">
                    <div>
                      <dt>Nhận xe</dt>
                      <dd>27/10/2026 · 08:00 UTC+7</dd>
                    </div>
                    <div>
                      <dt>Trả xe</dt>
                      <dd>29/10/2026 · 17:00 UTC+7</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <h3>
                    {vehicleFor(wizardVehicle).model} ·{" "}
                    {vehicleFor(wizardVehicle).plate}
                  </h3>
                  <p>27/10/2026 → 29/10/2026 · UTC+7</p>
                  <p className="notice notice-info">
                    Chưa có Rental API. Không thể tạo hợp đồng hoặc xác nhận
                    lịch thuê từ bản thiết kế.
                  </p>
                </>
              )}
              <div className="inline">
                {step > 1 && (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    Quay lại
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={() => setStep(step + 1)}>
                    Tiếp tục <Icon name="arrow" size={14} />
                  </Button>
                ) : (
                  <Button disabled>Tạo hợp đồng · Chờ API</Button>
                )}
              </div>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
