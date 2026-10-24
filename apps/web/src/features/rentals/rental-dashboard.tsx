"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  EmptyState,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/data-display/table";
import { RentalSchedule } from "@/features/dashboard/rental-schedule";
import { formatDate, queryString } from "@/lib/query";
import { formatMoney } from "./query";
import { RentalStatus } from "./rental-status";
import type { RentalPage } from "./types";
export function RentalDashboard({
  schedule,
  queue,
  activeTotal,
  overdueTotal,
  currency,
  overdue,
  asOf,
}: {
  schedule: RentalPage;
  queue: RentalPage;
  activeTotal: number;
  overdueTotal: number;
  currency: string;
  overdue: boolean;
  asOf: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(
        `/app?${queryString({ schedulePage: schedule.page, queuePage: queue.page, overdue: overdue ? "true" : "", ...values })}`,
        { scroll: false },
      ),
    );
  }
  return (
    <div className="owner-rental-dashboard pending-region" aria-busy={pending}>
      <RefreshStatus pending={pending} />
      <div className="owner-operation-grid">
        <Panel className="owner-schedule-panel">
          <PanelHeader
            title="Lịch xe đã đặt"
            subtitle={`${schedule.total} hợp đồng đã đặt · ${schedule.data.length} hợp đồng trong trang này`}
            icon="calendar"
            action={
              <Link
                className="link-brand"
                href="/app/rentals?status=RESERVED&sort=startAt&order=asc"
              >
                Xem tất cả <Icon name="arrow" size={14} />
              </Link>
            }
          />
          {schedule.data.length ? (
            <RentalSchedule
              key={`${schedule.page}:${schedule.data[0]?.id}`}
              rentals={schedule.data}
              asOf={asOf}
            />
          ) : (
            <EmptyState
              title={
                schedule.total
                  ? "Trang lịch này không có hợp đồng"
                  : "Chưa có lịch đặt xe"
              }
              description={
                schedule.total
                  ? "Quay lại trang trước để xem các hợp đồng đã đặt."
                  : "Xác nhận đặt xe để theo dõi thời gian bàn giao tại đây."
              }
              icon="calendar"
            />
          )}
          <Pagination
            disabled={pending}
            {...schedule}
            onPage={(schedulePage) => navigate({ schedulePage })}
          />
        </Panel>
        <Panel className="owner-queue-panel">
          <PanelHeader
            title="Hợp đồng đang vận hành"
            subtitle={`${activeTotal} đang thuê · ${overdueTotal} quá hạn trả xe`}
            icon="rental"
          />
          <div className="owner-queue-tabs">
            <Tabs
              items={[
                { value: "active", label: "Đang thuê", disabled: pending },
                {
                  value: "overdue",
                  label: `Quá hạn (${overdueTotal})`,
                  disabled: pending,
                },
              ]}
              value={overdue ? "overdue" : "active"}
              onChange={(value) =>
                navigate({
                  overdue: value === "overdue" ? "true" : "",
                  queuePage: 1,
                })
              }
            />
          </div>
          <div className="owner-rental-queue">
            {queue.data.map((rental) => (
              <Link
                className="owner-queue-card"
                href={`/app/rentals/${rental.id}`}
                key={rental.id}
              >
                <div className="owner-queue-card-header">
                  <span>#{rental.id.slice(0, 8)}</span>
                  <RentalStatus
                    status={rental.status}
                    overdue={rental.isOverdue}
                  />
                </div>
                <div className="owner-queue-identity">
                  <span className="owner-queue-vehicle-icon">
                    <Icon name="car" size={25} />
                  </span>
                  <div>
                    <strong>{rental.vehicle.licensePlate}</strong>
                    <small>
                      {rental.vehicle.make} {rental.vehicle.model} ·{" "}
                      {rental.customer.name}
                    </small>
                  </div>
                  <Icon name="chevron" size={17} />
                </div>
                <div
                  className={`owner-queue-due ${rental.isOverdue ? "is-overdue" : ""}`}
                >
                  <Icon name="clock" size={14} />
                  <span>
                    {rental.isOverdue ? "Quá hạn" : "Hẹn trả"}:{" "}
                    {formatDate(rental.endAt)}
                  </span>
                </div>
                <div className="owner-queue-amount">
                  <span>Tiền thuê theo hợp đồng</span>
                  <strong>{formatMoney(rental.rentalAmount, currency)}</strong>
                </div>
              </Link>
            ))}
            {!queue.data.length && (
              <EmptyState
                title={
                  overdue
                    ? "Không có hợp đồng quá hạn trong trang này"
                    : "Không có hợp đồng đang thuê trong trang này"
                }
                description={
                  queue.total
                    ? "Quay lại trang trước để xem các hợp đồng khác."
                    : "Các hợp đồng trong nhóm này sẽ xuất hiện tại đây."
                }
                icon="rental"
              />
            )}
          </div>
          <Pagination
            disabled={pending}
            {...queue}
            onPage={(queuePage) => navigate({ queuePage })}
          />
        </Panel>
      </div>
    </div>
  );
}
