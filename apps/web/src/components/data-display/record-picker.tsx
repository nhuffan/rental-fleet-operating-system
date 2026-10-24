"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import {
  Button,
  Input,
  EmptyState,
  RefreshStatus,
  Skeleton,
} from "@/components/ui/primitives";
import { SearchField } from "@/components/ui/controls";
import { Pagination } from "@/components/data-display/table";
import { queryString } from "@/lib/query";
type Page<T> = { data: T[]; page: number; limit: number; total: number };
export function RecordPicker<T extends { id: string }>({
  businessId,
  path,
  title,
  selected,
  onSelect,
  render,
  disabled = false,
}: {
  businessId: string;
  path: string;
  title: string;
  selected: string;
  onSelect: (item: T | null) => void;
  render: (item: T) => ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState({ search: "", page: 1, retry: 0 });
  const scope = `${businessId}:${path}`;
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    data: Page<T>;
  } | null>(null);
  const result = snapshot?.scope === scope ? snapshot.data : null;
  const [failure, setFailure] = useState<{
    scope: string;
    message: string;
  } | null>(null);
  const error = failure?.scope === scope ? failure.message : "";
  const [loading, setLoading] = useState(true);
  function change(next: typeof query) {
    setLoading(true);
    setFailure(null);
    onSelect(null);
    setQuery(next);
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const {
          data: { session },
        } = await browserClient().auth.getSession();
        if (controller.signal.aborted) return;
        if (!session) {
          router.replace("/login");
          return;
        }
        const qs = queryString({
          search: query.search,
          page: query.page,
          limit: 10,
        });
        const response = await fetch(
          `${publicEnv().api}/api/v1${path}${path.includes("?") ? "&" : "?"}${qs}`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "X-Business-Id": businessId,
            },
          },
        );
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? "Bạn không có quyền xem danh mục này."
              : "Không thể tải danh mục. Vui lòng thử lại.",
          );
        const data: Page<T> = await response.json();
        if (!controller.signal.aborted) {
          setSnapshot({ scope, data });
          setFailure(null);
          setLoading(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setFailure({
            scope,
            message:
              cause instanceof Error
                ? cause.message
                : "Không thể tải danh mục.",
          });
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, path, query, router, scope]);
  const pending = loading || (!result && !error);
  return (
    <div className="rental-picker" data-dirty-ignore>
      <form
        className="fleet-device-search"
        onSubmit={(e) => {
          e.preventDefault();
          change({
            ...query,
            page: 1,
            search: String(new FormData(e.currentTarget).get("search")).trim(),
          });
        }}
      >
        <SearchField
          label={`Tìm ${title.toLowerCase()}`}
          name="search"
          maxLength={100}
          disabled={disabled || pending}
          placeholder="Tìm trong toàn bộ danh mục…"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || pending}
        >
          Tìm kiếm
        </Button>
      </form>
      <RefreshStatus
        pending={pending}
        label={
          result
            ? `Đang cập nhật ${title.toLowerCase()} · Giữ kết quả lần tải trước…`
            : `Đang tải ${title.toLowerCase()}…`
        }
      />
      {!result && pending && (
        <div aria-hidden="true" className="panel-body">
          <Skeleton className="skeleton-panel" />
        </div>
      )}
      {error && (
        <div role="alert">
          <p className="notice notice-danger">
            {error}
            {result && " Kết quả bên dưới thuộc lần tải thành công trước đó."}
          </p>
          <Button
            variant="secondary"
            onClick={() => change({ ...query, retry: query.retry + 1 })}
          >
            Thử lại
          </Button>
        </div>
      )}
      {result && (
        <div className="pending-region" aria-busy={pending}>
          <fieldset
            className="fleet-device-options"
            disabled={disabled || pending || !!error}
          >
            <legend>{title}</legend>
            {result.data.map((item) => (
              <label className="fleet-device-option" key={item.id}>
                <Input
                  type="radio"
                  name={title}
                  checked={selected === item.id}
                  onChange={() => onSelect(item)}
                />
                <span>{render(item)}</span>
              </label>
            ))}
            {!result.data.length && (
              <EmptyState
                title="Không có kết quả phù hợp"
                description="Thử khoảng thời gian hoặc từ khóa khác. Bạn có thể thêm dữ liệu tại danh mục tương ứng."
              />
            )}
          </fieldset>
          <Pagination
            disabled={disabled || pending || !!error}
            {...result}
            onPage={(page) => {
              if (!disabled) change({ ...query, page });
            }}
          />
        </div>
      )}
    </div>
  );
}
