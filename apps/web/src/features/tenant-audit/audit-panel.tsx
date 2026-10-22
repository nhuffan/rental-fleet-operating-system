"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { components } from "@rental-fleet/contracts/src/openapi";
import { Panel, PanelHeader, Badge } from "@/components/ui/primitives";
import {
  DataTable,
  SearchInput,
  Pagination,
} from "@/components/data-display/table";
type AuditPage = components["schemas"]["AuditPage"];
export function AuditPanel({
  initial,
  timezone,
}: {
  initial: AuditPage;
  timezone: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  let validTimezone = timezone;
  try {
    new Intl.DateTimeFormat("vi", { timeZone: timezone }).format();
  } catch {
    validTimezone = "UTC";
  }
  const date = (value: string) =>
    new Intl.DateTimeFormat("vi", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: validTimezone,
    }).format(new Date(value));
  return (
    <Panel>
      <PanelHeader
        title="Nhật ký hoạt động"
        subtitle={`Chỉ doanh nghiệp hiện tại · Múi giờ ${validTimezone}`}
        icon="audit"
      />
      <div className="table-toolbar">
        <SearchInput value={query} onChange={setQuery} />
        <span className="quiet">{initial.total} sự kiện</span>
      </div>
      <DataTable
        caption="Nhật ký thay đổi doanh nghiệp"
        rows={initial.data.filter((r) =>
          `${r.action} ${r.entityType} ${r.actorUserId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )}
        columns={[
          {
            key: "action",
            label: "Sự kiện",
            render: (r) => <Badge tone="info">{r.action}</Badge>,
          },
          {
            key: "entity",
            label: "Đối tượng",
            render: (r) => (
              <>
                {r.entityType}
                <small>
                  <code>{r.entityId}</code>
                </small>
              </>
            ),
          },
          {
            key: "actor",
            label: "Người thực hiện",
            render: (r) => <code>{r.actorUserId}</code>,
          },
          { key: "time", label: "Thời gian", render: (r) => date(r.createdAt) },
        ]}
      />
      <Pagination
        {...initial}
        onPage={(p) => router.push(`/app/audit?page=${p}`)}
      />
    </Panel>
  );
}
