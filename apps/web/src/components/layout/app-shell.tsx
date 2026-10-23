"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Me } from "@rental-fleet/contracts";
import { BusinessPicker, Logout } from "@/app/app/shell-controls";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, Button } from "@/components/ui/primitives";
type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  preview?: boolean;
};
const fleetItems: [string, string, IconName][] = [
  ["vehicles", "Đội xe", "car"],
  ["rentals", "Hợp đồng thuê", "rental"],
  ["customers", "Khách hàng", "users"],
  ["fleet-map", "Bản đồ đội xe", "map"],
  ["trips", "Hành trình", "trip"],
  ["commercial", "Thương mại", "wallet"],
];
const platformItems: [string, string, IconName][] = [
  ["", "Tổng quan", "grid"],
  ["businesses", "Doanh nghiệp", "business"],
  ["users", "Người dùng", "users"],
  ["features", "Tính năng", "grid"],
  ["integrations", "Tích hợp & GPS", "signal"],
  ["audit", "Nhật ký nền tảng", "audit"],
  ["settings", "Cài đặt hệ thống", "settings"],
];
export function AppShell({
  children,
  context,
  previewDomain,
  showPreviews = false,
}: {
  children: ReactNode;
  context?: Me;
  previewDomain?: "business" | "platform";
  showPreviews?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resetNavigation = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", resetNavigation);
    return () => desktop.removeEventListener("change", resetNavigation);
  }, []);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),select:not(:disabled)",
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      trigger?.focus();
    };
  }, [open]);
  const platform = previewDomain === "platform";
  const preview = !!previewDomain;
  const prefix = preview ? `/dev-preview/${previewDomain}` : "/app";
  const core: NavItem[] = platform
    ? platformItems.map(([path, label, icon]) => ({
        href: prefix + (path ? `/${path}` : ""),
        label,
        icon,
      }))
    : [
        { href: prefix, label: "Tổng quan", icon: "grid" },
        ...(!preview && context?.permissions.includes("vehicle.read")
          ? [{ href: "/app/vehicles", label: "Đội xe", icon: "car" as const }]
          : []),
        ...(!preview && context?.permissions.includes("rental.read")
          ? [
              {
                href: "/app/rentals",
                label: "Hợp đồng thuê",
                icon: "rental" as const,
              },
            ]
          : []),
        ...(!preview && context?.permissions.includes("customer.read")
          ? [
              {
                href: "/app/customers",
                label: "Khách hàng",
                icon: "users" as const,
              },
            ]
          : []),
        ...(!preview && context?.permissions.includes("gps.read")
          ? [
              {
                href: "/app/fleet-map",
                label: "Bản đồ đội xe",
                icon: "map" as const,
              },
            ]
          : []),
        ...(!preview && context?.permissions.includes("trip.read")
          ? [{ href: "/app/trips", label: "Hành trình", icon: "trip" as const }]
          : []),
        ...(preview || showPreviews
          ? fleetItems
              .filter(
                ([path]) =>
                  preview ||
                  ![
                    "vehicles",
                    "rentals",
                    "customers",
                    "fleet-map",
                    "trips",
                  ].includes(path),
              )
              .map(([path, label, icon]) => ({
                href: `${preview ? prefix : "/app"}/${path}`,
                label,
                icon,
                preview: true,
              }))
          : []),
      ];
  const management: NavItem[] = platform
    ? []
    : [
        { href: `${prefix}/business`, label: "Doanh nghiệp", icon: "business" },
        ...(preview || context?.permissions.includes("user.read")
          ? [
              {
                href: `${prefix}/users`,
                label: "Thành viên & quyền",
                icon: "users" as const,
              },
            ]
          : []),
        { href: `${prefix}/branches`, label: "Chi nhánh", icon: "pin" },
        ...(preview || context?.permissions.includes("audit.read")
          ? [
              {
                href: `${prefix}/audit`,
                label: "Nhật ký hoạt động",
                icon: "audit" as const,
              },
            ]
          : []),
      ];
  const settings = {
    href: `${prefix}/settings`,
    label: "Cài đặt",
    icon: "settings" as const,
  };
  const all = [...core, ...management, settings];
  const current =
    all.find((i) => i.href === pathname)?.label ??
    (pathname.startsWith("/app/vehicles/")
      ? "Đội xe"
      : pathname.startsWith("/app/rentals/")
        ? "Hợp đồng thuê"
        : pathname.startsWith("/app/trips/")
          ? "Hành trình"
          : pathname.startsWith("/app/customers/")
            ? "Khách hàng"
            : undefined) ??
    (pathname.includes("businesses/")
      ? "Chi tiết doanh nghiệp"
      : "Không gian làm việc");
  function nav(items: NavItem[]) {
    return items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={`nav-link ${pathname === item.href || (["/app/vehicles", "/app/rentals", "/app/customers", "/app/trips"].includes(item.href) && pathname.startsWith(`${item.href}/`)) ? "is-active" : ""}`}
        aria-current={
          pathname === item.href ||
          ([
            "/app/vehicles",
            "/app/rentals",
            "/app/customers",
            "/app/trips",
          ].includes(item.href) &&
            pathname.startsWith(`${item.href}/`))
            ? "page"
            : undefined
        }
        onClick={() => setOpen(false)}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {item.preview && <small>Preview</small>}
      </Link>
    ));
  }
  return (
    <div className={`workspace ${open ? "nav-open" : ""}`}>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className="app-sidebar"
        id="workspace-navigation"
        aria-label="Điều hướng không gian làm việc"
      >
        <Button
          className="sidebar-close"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu điều hướng"
        >
          <Icon name="close" />
        </Button>
        <Link href={prefix} className="brand">
          <span className="brand-symbol">
            <Icon name="car" size={25} />
          </span>
          <span>
            Rental Fleet
            <small>{platform ? "PLATFORM CONSOLE" : "OPERATING SYSTEM"}</small>
          </span>
        </Link>
        {!preview && context?.permissions.includes("rental.manage") ? (
          <Link
            className="button button-primary create-action"
            href="/app/rentals/new"
          >
            <Icon name="plus" /> Tạo hợp đồng
          </Link>
        ) : preview ? (
          <Button
            className="create-action"
            disabled
            title="Thao tác không khả dụng trong bản thiết kế"
          >
            <Icon name="plus" />
            {platform ? "Tạo doanh nghiệp" : "Tạo hợp đồng"}
            <small>Preview</small>
          </Button>
        ) : null}
        <div className="business-context">
          <span className="context-avatar">
            <Icon name={platform ? "globe" : "business"} />
          </span>
          {context ? (
            <BusinessPicker
              businesses={context.businesses}
              selected={context.business.id}
            />
          ) : (
            <div>
              <strong>
                {platform ? "Rental Fleet Platform" : "Minh An Mobility"}
              </strong>
              <small>
                {platform ? "Môi trường thiết kế" : "Doanh nghiệp minh họa"}
              </small>
            </div>
          )}
        </div>
        <div className="nav-label">
          {platform ? "NỀN TẢNG" : "KHÔNG GIAN VẬN HÀNH"}
        </div>
        <nav aria-label="Điều hướng chính" className="sidebar-nav">
          {nav(core)}
        </nav>
        {!!management.length && (
          <>
            <div className="nav-label">QUẢN LÝ</div>
            <nav aria-label="Quản lý doanh nghiệp" className="sidebar-nav">
              {nav(management)}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          {!platform && nav([settings])}
          {showPreviews && !preview && (
            <Link className="preview-entry" href="/dev-preview/business">
              Khám phá giao diện mới <Icon name="arrow" size={14} />
            </Link>
          )}
          {preview && (
            <Link
              className="preview-entry"
              href={
                platform ? "/dev-preview/business" : "/dev-preview/platform"
              }
            >
              {platform ? "Business Admin preview" : "Platform preview"}
              <Icon name="arrow" size={14} />
            </Link>
          )}
          <div className="user-block">
            <span className="avatar">
              {(context?.user.displayName || "UI").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{context?.user.displayName || "Design workspace"}</strong>
              <small>{context?.role || "Dữ liệu minh họa"}</small>
            </div>
          </div>
          {context && <Logout />}
        </div>
      </aside>
      <div className="workspace-main" inert={open}>
        <header className="topbar">
          <div className="inline">
            <Button
              variant="ghost"
              className="mobile-menu"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              aria-label="Mở điều hướng"
            >
              <Icon name="menu" />
            </Button>
            <span className="topbar-home">
              <Icon name={platform ? "globe" : "business"} />
              {platform ? "Platform" : "Workspace"}
            </span>
            <Icon name="chevron" size={13} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-meta">
            {preview ? (
              <Badge tone="warning">Design preview</Badge>
            ) : (
              <Badge tone="success">{context?.role}</Badge>
            )}
            <span className="topbar-email">
              {context?.user.email || "Development only"}
            </span>
            <span className="avatar avatar-small">
              {(context?.user.displayName || "UI").slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="workspace-content"
          key={context?.business.id ?? prefix}
        >
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Rental Fleet OS</span>
          <span>
            {platform
              ? "Quản trị nền tảng"
              : "Không gian vận hành doanh nghiệp"}{" "}
            · {preview ? "Design preview" : "SaaS Core"}
          </span>
        </footer>
      </div>
    </div>
  );
}
