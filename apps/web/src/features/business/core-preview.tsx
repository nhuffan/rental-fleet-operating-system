import type { Me, Branch, Membership, Page } from "@rental-fleet/contracts";
import { BusinessProfile } from "./business-profile";
import { MembersPanel } from "@/features/memberships/members-panel";
import { BranchesPanel } from "@/features/branches/branches-panel";
import { SettingsForm } from "@/features/settings/settings-form";
import { AuditPanel } from "@/features/tenant-audit/audit-panel";
import { PageHeader } from "@/components/ui/primitives";
const business = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Minh An Mobility",
  status: "ACTIVE",
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-22T00:00:00Z",
};
const context: Me = {
  user: {
    id: "preview",
    displayName: "Người dùng minh họa",
    email: "preview@example.invalid",
  },
  business,
  role: "OPERATIONS",
  permissions: [],
  businesses: [{ id: business.id, name: business.name, role: "OPERATIONS" }],
};
const branches: Page<Branch> = {
  page: 1,
  limit: 20,
  total: 2,
  data: ["Trung tâm", "Đông thành phố"].map((name, i) => ({
    id: `branch-${i}`,
    businessId: business.id,
    name,
    address: "Địa chỉ minh họa",
    status: "ACTIVE",
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  })),
};
const members: Page<Membership> = {
  page: 1,
  limit: 20,
  total: 3,
  data: (["OWNER", "ADMIN", "OPERATIONS"] as const).map((roleKey, i) => ({
    id: `member-${i}`,
    businessId: business.id,
    userId: `00000000-0000-4000-8000-00000000000${i + 2}`,
    displayName: `Thành viên minh họa ${i + 1}`,
    roleKey,
    status: "ACTIVE",
  })),
};
export function CorePreview({ screen }: { screen: string }) {
  return (
    <>
      <PageHeader
        title={
          {
            business: "Doanh nghiệp",
            users: "Thành viên & quyền",
            branches: "Chi nhánh",
            settings: "Cài đặt",
            audit: "Nhật ký hoạt động",
          }[screen] ?? "SaaS Core"
        }
        description="Mẫu chỉ xem của component SaaS Core. Màn /app sử dụng API thật."
      />
      {screen === "business" ? (
        <BusinessProfile business={business} context={context} />
      ) : screen === "users" ? (
        <MembersPanel initial={members} context={context} />
      ) : screen === "branches" ? (
        <BranchesPanel initial={branches} context={context} />
      ) : screen === "settings" ? (
        <SettingsForm
          settings={{
            businessId: business.id,
            config: { locale: "vi", dateFormat: "DMY" },
          }}
          context={context}
        />
      ) : (
        <AuditPanel
          timezone={business.timezone}
          initial={{ page: 1, limit: 20, total: 0, data: [] }}
        />
      )}
    </>
  );
}
