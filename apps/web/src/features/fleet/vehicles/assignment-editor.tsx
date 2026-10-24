"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { useMutation } from "@/lib/api-client/use-mutation";
import {
  ConfirmDialog,
  DialogActions,
  FormDialog,
} from "@/components/ui/form-dialog";
import { Button, EmptyState, Input } from "@/components/ui/primitives";
import { Pagination } from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import type { DeviceAssignment, GpsDevicePage, Vehicle } from "./types";
import { queryString } from "@/lib/query";
export function AssignmentEditor({
  businessId,
  vehicle,
  ending,
  onClose,
  onSaved,
}: {
  businessId: string;
  vehicle: Vehicle;
  ending?: DeviceAssignment;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const mutation = useMutation(businessId);
  if (ending) {
    return (
      <ConfirmDialog
        busy={mutation.busy}
        title="Tháo thiết bị khỏi xe"
        onClose={onClose}
        footer={
          <DialogActions
            formId="end-device-assignment-form"
            busy={mutation.busy}
            onCancel={onClose}
            submitLabel="Xác nhận tháo thiết bị"
          />
        }
      >
        <MutationNotice {...mutation} />
        <p>
          <strong>{vehicle.licensePlate}</strong> · {vehicle.make}{" "}
          {vehicle.model}
        </p>
        <p>
          Tháo thiết bị{" "}
          <strong>{ending.device.label || ending.device.deviceUid}</strong> khỏi
          xe này? Lịch sử gắn được giữ lại.
        </p>
        <form
          id="end-device-assignment-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await mutation.mutate({
              path: `/vehicles/${vehicle.id}/device-assignments/${ending.id}/end`,
              method: "POST",
            });
            if (ok) {
              onSaved?.();
              onClose();
            }
          }}
        />
      </ConfirmDialog>
    );
  }
  return (
    <AvailableDevicePicker
      businessId={businessId}
      vehicle={vehicle}
      busy={mutation.busy}
      errorNotice={mutation.error}
      onClose={onClose}
      onAssign={async (deviceId) => {
        const ok = await mutation.mutate({
          path: `/vehicles/${vehicle.id}/device-assignments`,
          method: "POST",
          body: { deviceId },
        });
        if (ok) {
          onSaved?.();
          onClose();
        }
      }}
    />
  );
}
function AvailableDevicePicker({
  businessId,
  vehicle,
  busy,
  errorNotice,
  onClose,
  onAssign,
}: {
  businessId: string;
  vehicle: Vehicle;
  busy: boolean;
  errorNotice: string;
  onClose: () => void;
  onAssign: (deviceId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState({ search: "", page: 1, retry: 0 });
  const [result, setResult] = useState<GpsDevicePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const changeQuery = (next: typeof query) => {
    setLoading(true);
    setError("");
    setSelected("");
    setQuery(next);
  };
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
          page: query.page,
          limit: 20,
          search: query.search,
          status: "ACTIVE",
          available: "true",
          sort: "deviceUid",
          order: "asc",
        });
        const response = await fetch(
          `${publicEnv().api}/api/v1/gps-devices?${qs}`,
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
              ? "Bạn không có quyền xem thiết bị."
              : "Không thể tải thiết bị. Vui lòng thử lại.",
          );
        const page: GpsDevicePage = await response.json();
        if (!controller.signal.aborted) {
          setResult(page);
          setLoading(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Không thể tải thiết bị.",
          );
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, query, router]);
  return (
    <FormDialog
      title="Gắn thiết bị GPS"
      onClose={onClose}
      busy={busy}
      dirty={!!selected}
      footer={
        <DialogActions
          formId="device-assignment-form"
          busy={busy}
          onCancel={onClose}
          submitLabel="Gắn thiết bị đã chọn"
          submitDisabled={loading || !!error || !selected}
        />
      }
    >
      <MutationNotice error={errorNotice} message="" />
      <p>
        <strong>{vehicle.licensePlate}</strong> · {vehicle.make} {vehicle.model}
      </p>
      <form
        id="device-assignment-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !loading && !error && selected) void onAssign(selected);
        }}
      />
      <p className="quiet">
        Chỉ hiển thị thiết bị đang hoạt động và chưa gắn vào xe. Tìm kiếm áp
        dụng cho toàn bộ danh mục.
      </p>
      <form
        className="fleet-device-search"
        onSubmit={(e) => {
          e.preventDefault();
          const search = String(
            new FormData(e.currentTarget).get("search"),
          ).trim();
          changeQuery({ ...query, search, page: 1 });
        }}
      >
        <label className="form-field">
          Tìm thiết bị
          <Input
            type="search"
            name="search"
            maxLength={100}
            placeholder="UID hoặc nhãn thiết bị…"
            disabled={busy}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy}>
          Tìm kiếm
        </Button>
      </form>
      {loading && <p role="status">Đang tải thiết bị…</p>}
      {error && (
        <div role="alert">
          <p className="notice notice-danger">{error}</p>
          <Button
            variant="secondary"
            onClick={() => changeQuery({ ...query, retry: query.retry + 1 })}
          >
            Thử lại
          </Button>
        </div>
      )}
      {!loading && !error && result && (
        <>
          <fieldset className="fleet-device-options" disabled={busy}>
            <legend>Chọn thiết bị</legend>
            {result.data.map((device) => (
              <label className="fleet-device-option" key={device.id}>
                <Input
                  type="radio"
                  name="selectedDevice"
                  checked={selected === device.id}
                  onChange={() => setSelected(device.id)}
                />
                <span>
                  <strong>{device.label || device.deviceUid}</strong>
                  <small>
                    {device.provider} · {device.deviceUid}
                  </small>
                </span>
              </label>
            ))}
            {!result.data.length && (
              <EmptyState
                title="Không có thiết bị phù hợp"
                description="Thử tìm UID khác hoặc đăng ký thiết bị ở tab Thiết bị GPS."
                icon="signal"
              />
            )}
          </fieldset>
          <Pagination
            {...result}
            onPage={(page) => {
              if (!busy) changeQuery({ ...query, page });
            }}
          />
        </>
      )}
    </FormDialog>
  );
}
