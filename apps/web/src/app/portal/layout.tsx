import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Logout } from "@/app/app/shell-controls";
import { portalContext } from "@/features/portal/server";

export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await portalContext();
  return (
    <div className="portal-frame">
      <header className="portal-header no-print">
        <Link href="/portal" aria-label="Trang chủ cổng khách thuê">
          <BrandLockup compact />
        </Link>
        <div className="portal-identity">
          <strong>{context.customerName}</strong>
          <small>{context.businessName}</small>
        </div>
        <Logout />
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
