"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import { RentalTable } from "./rental-table";
import type { RentalPage } from "./types";
export function RentalDashboard({
  schedule,
  queue,
  overdueTotal,
  currency,
  overdue,
}: {
  schedule: RentalPage;
  queue: RentalPage;
  overdueTotal: number;
  currency: string;
  overdue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(
        `/app?${queryString({ schedulePage: schedule.page, queuePage: queue.page, overdue: overdue ? "true" : "", ...values })}`,
      ),
    );
  }
  return (
    <div className="rental-dashboard" aria-busy={pending}>
      <Panel>
        <PanelHeader
          title="Lịch xe đã đặt"
          subtitle={`${schedule.total} hợp đồng đã đặt · Theo giờ Việt Nam`}
          icon="calendar"
          action={
            <Link
              className="link-brand"
              href="/app/rentals?status=RESERVED&sort=startAt&order=asc"
            >
              Tất cả hợp đồng →
            </Link>
          }
        />
        <div className="rental-schedule">
          {schedule.data.map((rental) => (
            <Link
              className="rental-schedule-item"
              href={`/app/rentals/${rental.id}`}
              key={rental.id}
            >
              <div>
                <strong>{rental.vehicle.licensePlate}</strong>
                <small>{rental.customer.name}</small>
              </div>
              <div>
                <strong>{formatDate(rental.startAt)}</strong>
                <small>→ {formatDate(rental.endAt)}</small>
              </div>
              <span className="link-brand">Chi tiết →</span>
            </Link>
          ))}
          {!schedule.data.length && (
            <EmptyState
              title="Chưa có lịch đặt xe"
              description="Các hợp đồng được xác nhận đặt xe sẽ xuất hiện tại đây."
              icon="calendar"
            />
          )}
        </div>
        <Pagination
          {...schedule}
          onPage={(schedulePage) => navigate({ schedulePage })}
        />
      </Panel>
      <Panel>
        <PanelHeader
          title="Hợp đồng đang vận hành"
          subtitle={`${overdueTotal} hợp đồng quá hạn cần nhận trả`}
          icon="rental"
        />
        <div className="rental-queue-tabs">
          <Button
            variant={overdue ? "secondary" : "primary"}
            aria-pressed={!overdue}
            disabled={pending}
            onClick={() => navigate({ overdue: "", queuePage: 1 })}
          >
            Đang thuê
          </Button>
          <Button
            variant={overdue ? "primary" : "secondary"}
            aria-pressed={overdue}
            disabled={pending}
            onClick={() => navigate({ overdue: "true", queuePage: 1 })}
          >
            Quá hạn ({overdueTotal})
          </Button>
        </div>
        <RentalTable rentals={queue.data} currency={currency} />
        <Pagination
          {...queue}
          onPage={(queuePage) => navigate({ queuePage })}
        />
      </Panel>
    </div>
  );
}
