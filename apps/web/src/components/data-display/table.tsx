"use client";
import type { ReactNode } from "react";
import { Button, EmptyState } from "@/components/ui/primitives";
import { SearchField } from "@/components/ui/controls";
import { Icon, type IconName } from "@/components/ui/icon";
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
    <SearchField
      hideLabel
      label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  caption,
  emptyState,
}: {
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => ReactNode }[];
  caption: string;
  emptyState?: {
    title?: string;
    description?: string;
    icon?: IconName;
    action?: ReactNode;
  };
}) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
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
          description="Thử thay đổi bộ lọc hoặc dùng từ khóa tìm kiếm khác."
          {...emptyState}
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
  disabled = false,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span className="pagination-count">
        {total && (page - 1) * limit < total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`
          : total
            ? `${total} kết quả · Trang này không có dữ liệu`
            : "0 kết quả"}
      </span>
      <div className="pagination-controls">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <span className="pagination-previous-icon">
            <Icon name="chevron" size={16} />
          </span>
          Trước
        </Button>
        <span className="pagination-page" aria-live="polite">
          Trang {page}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || page * limit >= total}
          onClick={() => onPage(page + 1)}
        >
          Sau <Icon name="chevron" size={16} />
        </Button>
      </div>
    </nav>
  );
}
