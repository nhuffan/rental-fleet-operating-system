import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { queryString, validId, type SearchParams } from "@/lib/query";
import {
  platformApi,
  platformContext,
  requirePlatformPermission,
} from "@/features/platform/live/server";
import { SystemPanel } from "@/features/platform/live/system-panel";
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
  PlatformBusinessDetail as BusinessDetail,
  PlatformBusinessPage,
  PlatformOverview,
  PlatformSystem,
} from "@/features/platform/live/types";
const systemScreens: Record<string, { title: string; description: string }> =
  {
    features: {
      title: "Tính năng",
      description: "Tính năng đã triển khai, chỉ dữ liệu TEST và chưa triển khai.",
    },
    integrations: {
      title: "Tích hợp & GPS",
      description: "Trạng thái cấu hình Supabase, Storage, Traccar và bản đồ.",
    },
    settings: {
      title: "Cài đặt hệ thống",
      description: "Môi trường, cơ sở dữ liệu và giới hạn vận hành hiện tại.",
    },
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
      const b = await platformApi<BusinessDetail>(
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
            description="Quản lý trạng thái, quyền truy cập Owner và xem số liệu tổng hợp doanh nghiệp."
          />
          <PlatformBusinessDetail
            business={b}
            permissions={context.permissions}
          />
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
        <BusinessesPanel
          key="businesses"
          initial={data}
          filters={filters}
          permissions={context.permissions}
        />
      </>
    );
  }
  if (screen.length === 1 && systemScreens[screen[0]]) {
    await requirePlatformPermission("platform.system.read");
    const data = await platformApi<PlatformSystem>(
      "/platform/system",
      `/superadmin/${screen[0]}`,
    );
    const mode = screen[0] as "features" | "integrations" | "settings";
    return (
      <>
        <PageHeader
          title={systemScreens[mode].title}
          description={systemScreens[mode].description}
        />
        <SystemPanel mode={mode} data={data} />
      </>
    );
  }
  notFound();
}
