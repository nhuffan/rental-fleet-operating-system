"use client";
import type { ReactNode } from "react";
import { Button, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm trong trang hiện tại…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <Icon name="search" />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => ReactNode }[];
  caption: string;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <EmptyState
          title="Không có kết quả"
          description="Thử thay đổi bộ lọc hoặc thêm dữ liệu mới."
        />
      )}
    </div>
  );
}
export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`
          : "0 kết quả"}
      </span>
      <div className="inline">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Trước
        </Button>
        <span>Trang {page}</span>
        <Button
          variant="secondary"
          disabled={page * limit >= total}
          onClick={() => onPage(page + 1)}
        >
          Sau →
        </Button>
      </div>
    </div>
  );
}
