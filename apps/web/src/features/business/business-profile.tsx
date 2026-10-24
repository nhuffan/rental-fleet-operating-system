"use client";
import { Icon } from "@/components/ui/icon";
import type { Business, Me } from "@rental-fleet/contracts";
import { useMutation } from "@/lib/api-client/use-mutation";
import {
  Button,
  Input,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
export function BusinessProfile({
  business,
  context,
}: {
  business: Business;
  context: Me;
}) {
  const mutation = useMutation(context.business.id);
  const editable = context.permissions.includes("business.update");
  return (
    <>
      <MutationNotice {...mutation} />
      <div className="core-grid">
        <Panel>
          <PanelHeader
            icon="business"
            title="Hồ sơ doanh nghiệp"
            subtitle="Thông tin chung của không gian vận hành"
            action={<StatusBadge status={business.status} />}
          />
          <form
            key={business.updatedAt}
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void mutation.mutate({
                path: "/businesses/current",
                body: {
                  name: String(data.get("name")).trim(),
                  timezone: String(data.get("timezone")).trim(),
                  currency: String(data.get("currency")),
                },
              });
            }}
          >
            <fieldset disabled={!editable || mutation.busy}>
              <div className="form-section">
                <h3>Thông tin cơ bản</h3>
                <p>Thông tin này áp dụng cho toàn bộ doanh nghiệp.</p>
                <label className="form-field">
                  Tên doanh nghiệp
                  <Input
                    name="name"
                    defaultValue={business.name}
                    maxLength={120}
                    pattern=".*\S.*"
                    required
                    autoComplete="organization"
                  />
                </label>
                <div className="form-grid">
                  <label className="form-field">
                    Múi giờ
                    <Input
                      name="timezone"
                      defaultValue={business.timezone}
                      maxLength={80}
                      required
                    />
                    <small>Ví dụ: Asia/Ho_Chi_Minh</small>
                  </label>
                  <label className="form-field">
                    Tiền tệ
                    <Input
                      name="currency"
                      defaultValue={business.currency}
                      pattern="[A-Z]{3}"
                      maxLength={3}
                      required
                    />
                    <small>Mã ISO gồm 3 ký tự, ví dụ VND.</small>
                  </label>
                </div>
              </div>
              {editable && (
                <div className="form-actions">
                  <Button type="reset" variant="secondary">
                    Đặt lại
                  </Button>
                  <Button type="submit" disabled={mutation.busy}>
                    <Icon name="check" />
                    {mutation.busy ? "Đang lưu…" : "Lưu thay đổi"}
                  </Button>
                </div>
              )}
            </fieldset>
          </form>
        </Panel>
        <Panel>
          <PanelHeader
            icon="shield"
            title="Không gian của bạn"
            subtitle="Phạm vi truy cập được API xác minh"
          />
          <dl className="detail-list">
            <div>
              <dt>Không gian truy cập</dt>
              <dd>Owner</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <StatusBadge status={business.status} />
              </dd>
            </div>
            <div>
              <dt>Mã doanh nghiệp</dt>
              <dd>
                <code>{business.id}</code>
              </dd>
            </div>
          </dl>
          <div className="panel-body">
            <p className="quiet">
              {editable
                ? "Bạn có quyền cập nhật hồ sơ doanh nghiệp."
                : "Bạn có quyền xem. Liên hệ Owner để cập nhật hồ sơ."}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
