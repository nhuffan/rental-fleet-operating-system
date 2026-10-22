"use client";
import type { Me, Settings } from "@rental-fleet/contracts";
import {
  useMutation,
  type SettingsUpdate,
} from "@/lib/api-client/use-mutation";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
export function SettingsForm({
  settings,
  context,
}: {
  settings: Settings;
  context: Me;
}) {
  const mutation = useMutation(context.business.id);
  const editable = context.permissions.includes("settings.update");
  return (
    <div className="form-stack">
      <MutationNotice {...mutation} />
      <Panel>
        <PanelHeader
          title="Ngôn ngữ & hiển thị"
          subtitle="Tùy chọn dùng chung trong doanh nghiệp"
          icon="globe"
        />
        <form
          key={settings.updatedAt}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const config = {
              locale: data.get("locale"),
              dateFormat: data.get("dateFormat"),
            } as SettingsUpdate["config"];
            void mutation.mutate({ path: "/settings", body: { config } });
          }}
        >
          <fieldset disabled={!editable || mutation.busy}>
            <div className="form-section">
              <label className="form-field">
                Ngôn ngữ ưu tiên
                <select
                  name="locale"
                  defaultValue={settings.config.locale ?? "vi"}
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
                <small>
                  Lưu tùy chọn cho doanh nghiệp. Giao diện hiện tại sử dụng
                  tiếng Việt.
                </small>
              </label>
              <label className="form-field">
                Định dạng ngày
                <select
                  name="dateFormat"
                  defaultValue={settings.config.dateFormat ?? "DMY"}
                >
                  <option value="DMY">Ngày / Tháng / Năm</option>
                  <option value="ISO">Năm - Tháng - Ngày</option>
                </select>
              </label>
            </div>
            {editable && (
              <div className="form-actions">
                <Button type="reset" variant="secondary">
                  Đặt lại
                </Button>
                <Button type="submit" disabled={mutation.busy}>
                  {mutation.busy ? "Đang lưu…" : "Lưu cài đặt"}
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </Panel>
      {!editable && (
        <p className="quiet" style={{ marginTop: 16 }}>
          Chế độ chỉ xem. Bạn cần quyền cập nhật cài đặt để lưu thay đổi.
        </p>
      )}
    </div>
  );
}
