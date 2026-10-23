import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/primitives";
import { queryString, validId, type SearchParams } from "@/lib/query";
import {
  platformApi,
  platformContext,
  requirePlatformPermission,
} from "@/features/platform/live/server";
import { PlatformOverviewPanel } from "@/features/platform/live/overview";
import { BusinessesPanel } from "@/features/platform/live/businesses-panel";
import { PlatformBusinessDetail } from "@/features/platform/live/business-detail";
import { businessFilters } from "@/features/platform/live/query";
import type {
  PlatformBusiness,
  PlatformBusinessPage,
  PlatformOverview,
} from "@/features/platform/live/types";
const unavailable: Record<string, string> = {
  users: "Người dùng nền tảng",
  features: "Quản lý tính năng",
  integrations: "Tích hợp & GPS",
  audit: "Nhật ký nền tảng",
  settings: "Cài đặt hệ thống",
};
export default async function Superadmin({
  params,
  searchParams,
}: {
  params: Promise<{ screen?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  await platformContext();
  const { screen = [] } = await params;
  if (screen.length === 0) {
    await requirePlatformPermission("platform.overview.read");
    const data = await platformApi<PlatformOverview>("/platform/overview");
    return (
      <>
        <PageHeader
          eyebrow="PLATFORM CONSOLE"
          title="Tổng quan nền tảng"
          description="Số liệu hiện tại từ API nền tảng được phân quyền độc lập với doanh nghiệp."
          action={<Badge tone="info">LIVE · Chỉ đọc</Badge>}
        />
        <PlatformOverviewPanel data={data} />
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
            eyebrow="PLATFORM CONSOLE"
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
          eyebrow="PLATFORM CONSOLE"
          title="Doanh nghiệp"
          description="Tìm kiếm và tra cứu doanh nghiệp bằng dữ liệu thật, có phân trang và quyền platform riêng."
        />
        <BusinessesPanel
          key={queryString(filters)}
          initial={data}
          filters={filters}
        />
      </>
    );
  }
  if (screen.length === 1 && unavailable[screen[0]])
    return (
      <>
        <PageHeader
          eyebrow="PLATFORM CONSOLE"
          title={unavailable[screen[0]]}
          description="Chức năng này chưa được triển khai cho console live."
          action={<Badge tone="neutral">Chưa khả dụng</Badge>}
        />
        <Panel>
          <EmptyState
            icon="shield"
            title="Chưa có API được phân quyền cho chức năng này"
            description="Hiện chỉ Tổng quan, Danh sách và Chi tiết doanh nghiệp dùng dữ liệu thật. Chức năng này sẽ được mở khi có backend và quyền tương ứng."
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
