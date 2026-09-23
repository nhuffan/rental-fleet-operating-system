import Link from "next/link";
import { currentContext } from "@/lib/api";
import { BusinessPicker, Logout } from "./shell-controls";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await currentContext();
  const items = [
    ["/app", "Tổng quan", true],
    ["/app/business", "Doanh nghiệp", true],
    ["/app/users", "Thành viên", context.permissions.includes("user.read")],
    ["/app/branches", "Chi nhánh", true],
    ["/app/settings", "Cài đặt", true],
  ] as const;
  return (
    <div className="workspace">
      <aside>
        <Link href="/app" className="brand">
          RF<span>Rental Fleet</span>
        </Link>
        <BusinessPicker
          businesses={context.businesses}
          selected={context.business.id}
        />
        <nav>
          {items
            .filter((i) => i[2])
            .map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="badge">{context.role}</span>
          <p>{context.user.displayName || context.user.email}</p>
          <Logout />
        </div>
      </aside>
      <div className="workspace-main">
        <header>
          <span>{context.business.name}</span>
          <span className="muted">{context.user.email}</span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
