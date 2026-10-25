import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { queryString, validId, type SearchParams } from "@/lib/query";
import {
  platformApi,
  platformContext,
  requirePlatformPermission,
} from "@/features/platform/live/server";
import { PlatformOverviewPanel } from "@/features/platform/live/overview";
import { BusinessesPanel } from "@/features/platform/live/businesses-panel";
import { PlatformBusinessDetail } from "@/features/platform/live/business-detail";
import {
  SupportPanel,
  UserDetailPanel,
} from "@/features/platform/live/support-panel";
import {
  businessFilters,
  auditFilters,
  userFilters,
} from "@/features/platform/live/query";
import type {
  PlatformAuditPage,
  PlatformUserPage,
  PlatformUserDetail,
  PlatformBusiness,
  PlatformBusinessPage,
  PlatformOverview,
} from "@/features/platform/live/types";
const unavailable: Record<string, string> = {
  features: "Quản lý tính năng",
  integrations: "Tích hợp & GPS",
  settings: "Cài đặt hệ thống",
};
export default async function Superadmin({
  params,
  searchParams,
}: {
  params: Promise<{ screen?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await platformContext();
  const { screen = [] } = await params;
  if (screen.length === 0) {
    await requirePlatformPermission("platform.overview.read");
    const [data, businesses, activity] = await Promise.all([
      platformApi<PlatformOverview>("/platform/overview"),
      context.permissions.includes("platform.business.read")
        ? platformApi<PlatformBusinessPage>(
            "/platform/businesses?page=1&limit=6&sort=name&order=asc",
          )
        : Promise.resolve(undefined),
      context.permissions.includes("platform.audit.read")
        ? platformApi<PlatformAuditPage>(
            "/platform/audit?page=1&limit=6&sort=createdAt&order=desc",
          )
        : Promise.resolve(undefined),
    ]);
    return (
      <>
        <PageHeader
          title="Tổng quan nền tảng"
          description="Doanh nghiệp, đội xe và hoạt động gần đây trên toàn nền tảng."
        />
        <PlatformOverviewPanel
          data={data}
          businesses={businesses}
          activity={activity}
        />
      </>
    );
  }
  if (screen[0] === "audit" && screen.length === 1) {
    await requirePlatformPermission("platform.audit.read");
    const filters = auditFilters(await searchParams);
    const data = await platformApi<PlatformAuditPage>(
      `/platform/audit?${queryString(filters)}`,
      `/superadmin/audit?${queryString(filters)}`,
    );
    const resolved = { ...filters, from: data.from, until: data.until };
    return (
      <>
        <PageHeader
          title="Nhật ký nền tảng"
          description="Theo dõi nhật ký theo thời gian, hành động và doanh nghiệp liên quan."
        />
        <SupportPanel mode="audit" key="audit" data={data} filters={resolved} />
      </>
    );
  }
  if (screen[0] === "users" && screen.length <= 2) {
    await requirePlatformPermission("platform.user.read");
    if (screen.length === 2) {
      if (!validId(screen[1])) notFound();
      const q = businessFilters(await searchParams);
      const path = `/superadmin/users/${screen[1]}`;
      const data = await platformApi<PlatformUserDetail>(
        `/platform/users/${screen[1]}?${queryString({ page: q.page, limit: q.limit })}`,
        path,
        { notFoundOn404: true },
      );
      return (
        <>
          <Link className="back-link" href="/superadmin/users">
            ← Danh sách người dùng
          </Link>
          <PageHeader
            title="Chi tiết người dùng"
            description="Hồ sơ hỗ trợ tối thiểu và liên kết doanh nghiệp; không có thao tác quản trị tài khoản."
          />
          <UserDetailPanel key={data.profile.id} data={data} />
        </>
      );
    }
    const filters = userFilters(await searchParams);
    const data = await platformApi<PlatformUserPage>(
      `/platform/users?${queryString(filters)}`,
      `/superadmin/users?${queryString(filters)}`,
    );
    return (
      <>
        <PageHeader
          title="Người dùng & hỗ trợ"
          description="Tra cứu hồ sơ người dùng và các liên kết doanh nghiệp."
        />
        <SupportPanel mode="users" key="users" data={data} filters={filters} />
      </>
    );
  }
  if (screen[0] === "businesses" && screen.length <= 2) {
    await requirePlatformPermission("platform.business.read");
    if (screen.length === 2) {
      if (!validId(screen[1])) notFound();
      const b = await platformApi<PlatformBusiness>(
        `/platform/businesses/${screen[1]}`,
        `/superadmin/businesses/${screen[1]}`,
        { notFoundOn404: true },
      );
      return (
        <>
          <Link className="back-link" href="/superadmin/businesses">
            ← Danh sách doanh nghiệp
          </Link>
          <PageHeader
            title="Chi tiết doanh nghiệp"
            description="Metadata và số liệu tổng hợp được phép xem; không thay đổi dữ liệu doanh nghiệp."
          />
          <PlatformBusinessDetail business={b} />
        </>
      );
    }
    const filters = businessFilters(await searchParams);
    const data = await platformApi<PlatformBusinessPage>(
      `/platform/businesses?${queryString(filters)}`,
      `/superadmin/businesses?${queryString(filters)}`,
    );
    return (
      <>
        <PageHeader
          title="Doanh nghiệp"
          description="Tìm kiếm và tra cứu doanh nghiệp bằng dữ liệu thật, có phân trang và quyền platform riêng."
        />
        <BusinessesPanel key="businesses" initial={data} filters={filters} />
      </>
    );
  }
  if (screen.length === 1 && unavailable[screen[0]])
    return (
      <>
        <PageHeader
          title={unavailable[screen[0]]}
          description="Chức năng này chưa được triển khai cho console live."
        />
        <Panel>
          <EmptyState
            icon="shield"
            title="Chức năng chưa sẵn sàng"
            description="Phần này đang được phát triển; hiện chưa có thao tác quản trị khả dụng."
          />
          <div className="panel-body">
            <Link className="button button-secondary" href="/superadmin">
              Về tổng quan nền tảng
            </Link>
          </div>
        </Panel>
      </>
    );
  notFound();
}
