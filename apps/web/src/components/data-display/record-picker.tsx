"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Button, EmptyState } from "@/components/ui/primitives";
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
  const [result, setResult] = useState<Page<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  function change(next: typeof query) {
    setLoading(true);
    setError("");
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
          setResult(data);
          setLoading(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Không thể tải danh mục.",
          );
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, path, query, router]);
  return (
    <div className="rental-picker">
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
        <label className="form-field">
          Tìm {title.toLowerCase()}
          <input
            name="search"
            type="search"
            maxLength={100}
            disabled={disabled}
            placeholder="Tìm trong toàn bộ danh mục…"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={disabled}>
          Tìm kiếm
        </Button>
      </form>
      {loading && <p role="status">Đang tải {title.toLowerCase()}…</p>}
      {error && (
        <div role="alert">
          <p className="notice notice-danger">{error}</p>
          <Button
            variant="secondary"
            onClick={() => change({ ...query, retry: query.retry + 1 })}
          >
            Thử lại
          </Button>
        </div>
      )}
      {!loading && !error && result && (
        <>
          <fieldset className="fleet-device-options" disabled={disabled}>
            <legend>{title}</legend>
            {result.data.map((item) => (
              <label className="fleet-device-option" key={item.id}>
                <input
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
            {...result}
            onPage={(page) => {
              if (!disabled) change({ ...query, page });
            }}
          />
        </>
      )}
    </div>
  );
}
