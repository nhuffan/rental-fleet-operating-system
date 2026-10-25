import Link from "next/link";
import { LiveFleetMap } from "@/features/telematics/gps/live-fleet-map";
import type { LocationPage } from "@/features/telematics/gps/types";
import { RentalDashboard } from "@/features/rentals/rental-dashboard";
import type { RentalPage } from "@/features/rentals/types";
import { MetricCard } from "@/components/data-display/metric-card";
import { PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { pageNumber, queryString, type SearchParams } from "@/lib/query";
import { api, currentContext } from "@/lib/api";
import "@/features/dashboard/owner-dashboard.css";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const schedulePage = pageNumber(params.schedulePage);
  const queuePage = pageNumber(params.queuePage);
  const overdue = params.overdue === "true";
  const c = await currentContext();
  const asOf = new Date();
  const availabilityWindow = {
    startAt: asOf.toISOString(),
    endAt: new Date(asOf.getTime() + 86400000).toISOString(),
  };
  const rentalAccess = c.permissions.includes("rental.read");
  const [schedule, queue, activeCount, overdueCount, availability, locations] =
    await Promise.all([
      rentalAccess
        ? api<RentalPage>(
            `/rentals?status=RESERVED&sort=startAt&order=asc&page=${schedulePage}&limit=6`,
          )
        : Promise.resolve(null),
      rentalAccess
        ? api<RentalPage>(
            `/rentals?status=ACTIVE&sort=endAt&order=asc&page=${queuePage}&limit=6${overdue ? "&overdue=true" : ""}`,
          )
        : Promise.resolve(null),
      rentalAccess
        ? api<RentalPage>("/rentals?status=ACTIVE&limit=1")
        : Promise.resolve(null),
      rentalAccess
        ? api<RentalPage>("/rentals?status=ACTIVE&overdue=true&limit=1")
        : Promise.resolve(null),
      rentalAccess
        ? api<{ total: number }>(
            `/vehicles/availability?${queryString({ ...availabilityWindow, availableOnly: "true", limit: 1 })}`,
          )
        : Promise.resolve(null),
      c.permissions.includes("gps.read")
        ? api<LocationPage>("/fleet/locations?limit=20")
        : Promise.resolve(null),
    ]);
  return (
    <div className="owner-dashboard">
      <PageHeader
        title="Tổng quan vận hành"
        description="Vị trí đội xe, lịch đặt và những hợp đồng cần theo dõi."
      />
      <div className="owner-dashboard-top">
        {locations && (
          <div className="dashboard-map owner-dashboard-map">
            <LiveFleetMap
              key={`dashboard-map:${c.business.id}`}
              businessId={c.business.id}
              initial={locations}
              compact
            />
          </div>
        )}
        {availability && activeCount && schedule && overdueCount && (
          <div className="owner-kpis">
            <MetricCard
              label="Trống 24 giờ tới"
              value={availability.total}
              description="Xe hoạt động, không vướng lịch thuê trong 24 giờ tới."
              icon="car"
              tone="success"
              href="/app/rentals"
            />
            <MetricCard
              label="Đang thuê"
              value={activeCount.total}
              description="Hợp đồng đã bàn giao và chưa nhận trả xe."
              icon="rental"
              tone="info"
              href="/app/rentals?status=ACTIVE&sort=endAt&order=asc"
            />
            <MetricCard
              label="Đã đặt xe"
              value={schedule.total}
              description="Hợp đồng đã xác nhận, đang chờ bàn giao."
              icon="calendar"
              tone="brand"
              href="/app/rentals?status=RESERVED&sort=startAt&order=asc"
            />
            <MetricCard
              label="Quá hạn trả"
              value={overdueCount.total}
              description="Đã qua giờ hẹn và chưa nhận trả xe."
              icon="clock"
              tone={overdueCount.total ? "danger" : "neutral"}
              href="/app/rentals?status=ACTIVE&overdue=true&sort=endAt&order=asc"
            />
          </div>
        )}
      </div>
      {schedule && queue && overdueCount && activeCount && (
        <RentalDashboard
          key={`rental-dashboard:${c.business.id}`}
          schedule={schedule}
          queue={queue}
          activeTotal={activeCount.total}
          overdueTotal={overdueCount.total}
          currency={c.business.currency}
          overdue={overdue}
          asOf={asOf.toISOString()}
        />
      )}
      <div className="owner-dashboard-footer">
        <p>
          <Icon name="clock" size={15} /> Lịch và chỉ số chụp tại{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            timeStyle: "short",
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(asOf)}{" "}
          · giờ Việt Nam. Tình trạng trống cần kiểm tra lại khi đặt xe.
        </p>
        {process.env.NODE_ENV === "development" && (
          <Link className="link-brand" href="/dev-preview/business">
            Bản thiết kế tham chiếu <Icon name="arrow" size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
