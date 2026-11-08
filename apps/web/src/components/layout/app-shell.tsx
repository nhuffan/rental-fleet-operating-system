"use client";
import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PlatformMe } from "@/features/platform/live/types";
import type { Me } from "@rental-fleet/contracts";
import { BusinessSwitcher } from "@/app/app/shell-controls";
import { UserAccountMenu } from "./user-account-menu";
import { NavigationLink, NavigationLoadingTarget } from "./navigation-link";
import { WorkspaceContext } from "./workspace-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  preview?: boolean;
  unavailable?: boolean;
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
  platformContext,
  showPreviews = false,
  accountEmail,
}: {
  children: ReactNode;
  context?: Me;
  platformContext?: PlatformMe;
  previewDomain?: "business" | "platform";
  showPreviews?: boolean;
  accountEmail?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navigationTarget, setNavigationTarget] =
    useState<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
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
  const platform = previewDomain === "platform" || !!platformContext;
  const preview = !!previewDomain;
  const prefix = preview
    ? `/dev-preview/${previewDomain}`
    : platform
      ? "/superadmin"
      : "/app";
  const core: NavItem[] = platform
    ? platformItems
        .filter(
          ([path]) =>
            preview ||
            (path === ""
              ? platformContext?.permissions.includes("platform.overview.read")
              : path === "businesses"
                ? platformContext?.permissions.includes(
                    "platform.business.read",
                  )
                : path === "audit"
                  ? platformContext?.permissions.includes("platform.audit.read")
                  : path === "users"
                    ? platformContext?.permissions.includes(
                        "platform.user.read",
                      )
                    : ["features", "integrations", "settings"].includes(path)
                      ? platformContext?.permissions.includes(
                          "platform.system.read",
                        )
                      : true),
        )
        .filter(([path]) => !preview || path !== "settings")
        .map(([path, label, icon]) => ({
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
        ...(!preview && context?.permissions.includes("alert.read")
          ? [
              {
                href: "/app/alerts",
                label: "Cảnh báo vận hành",
                icon: "alert" as const,
              },
            ]
          : []),
        ...(!preview && context?.permissions.includes("commercial.read")
          ? [
              {
                href: "/app/commercial",
                label: "Thương mại",
                icon: "wallet" as const,
              },
            ]
          : []),
        ...(!preview && context?.permissions.includes("report.read")
          ? [
              {
                href: "/app/reports",
                label: "Báo cáo",
                icon: "grid" as const,
              },
            ]
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
                    "commercial",
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
                label: "Quyền truy cập Owner",
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
  function nav(items: NavItem[]) {
    return items.map((item) => (
      <NavigationLink
        key={item.href}
        {...item}
        active={
          pathname === item.href ||
          ([
            "/app/vehicles",
            "/app/rentals",
            "/app/customers",
            "/app/trips",
            "/app/commercial",
            "/superadmin/businesses",
            "/superadmin/users",
          ].includes(item.href) &&
            pathname.startsWith(`${item.href}/`))
        }
        onNavigate={() => {
          setOpen(false);
          contentScrollRef.current?.scrollTo({ top: 0 });
        }}
      />
    ));
  }
  function navigationGroup(
    group: string,
    title: string,
    label: string,
    items: NavItem[],
  ) {
    return (
      <section className="sidebar-group" key={group}>
        <h2 className="nav-label">{title}</h2>
        <nav
          id={`sidebar-group-${group}`}
          aria-label={label}
          className="sidebar-nav"
        >
          {nav(items)}
        </nav>
      </section>
    );
  }
  const workspace = (
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
        {/* Stable intrinsic sizing includes every approved navigation label. */}
        <div className="sidebar-width-guide" aria-hidden="true">
          {[
            ...fleetItems,
            ...platformItems,
            ["alerts", "Cảnh báo vận hành", "alert"],
            ["users", "Quyền truy cập Owner", "users"],
            ["audit", "Nhật ký hoạt động", "audit"],
          ].map(([path, label, icon], index) => (
            <span className="sidebar-size-row" key={`${path}:${index}`}>
              <Icon name={icon as IconName} />
              <span>{label}</span>
            </span>
          ))}
          <span className="sidebar-size-heading">
            KHÔNG GIAN VẬN HÀNH <Icon name="chevron" size={14} />
          </span>
        </div>
        <div className="sidebar-brand-area">
          <Link href={prefix} className="brand">
            <BrandLockup />
          </Link>
          <Button
            className="sidebar-close"
            variant="ghost"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu điều hướng"
          >
            <Icon name="close" />
          </Button>
        </div>
        <div className="sidebar-menu">
          {navigationGroup(
            "core",
            platform ? "NỀN TẢNG" : "KHÔNG GIAN VẬN HÀNH",
            "Điều hướng chính",
            core,
          )}
          {!!management.length &&
            navigationGroup(
              "management",
              "QUẢN LÝ",
              "Quản lý doanh nghiệp",
              management,
            )}
        </div>
        <div className="sidebar-bottom">
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
              {platform ? "Owner preview" : "Platform preview"}
              <Icon name="arrow" size={14} />
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace-main" inert={open}>
        <header className="topbar">
          <div className="topbar-context">
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
            {platform ? (
              <WorkspaceContext
                icon="globe"
                label="Platform Console"
                preview={preview}
              />
            ) : context ? (
              <BusinessSwitcher
                businesses={context.businesses}
                selected={context.business.id}
              />
            ) : (
              <WorkspaceContext label="Minh An Mobility" preview />
            )}
          </div>
          <UserAccountMenu
            email={accountEmail}
            role={
              platformContext
                ? "Superadmin"
                : context
                  ? "Owner"
                  : "Dữ liệu minh họa"
            }
            settingsHref={platform ? undefined : `${prefix}/settings`}
            preview={preview}
          />
        </header>
        <div
          ref={contentScrollRef}
          className="workspace-scroll"
          role="region"
          aria-label="Nội dung không gian làm việc"
          tabIndex={0}
        >
          <main
            tabIndex={-1}
            id="main-content"
            className="workspace-content"
            key={context?.business.id ?? prefix}
          >
            <div
              className="workspace-navigation-loading"
              ref={setNavigationTarget}
            />
            <div className="workspace-route-content">{children}</div>
          </main>
          <footer className="workspace-footer">
            <span>carBase</span>
            <span>
              {platform
                ? "Quản trị nền tảng"
                : "Không gian vận hành doanh nghiệp"}{" "}
              ·{" "}
              {preview
                ? "Design preview"
                : platform
                  ? "Quản trị doanh nghiệp & Owner"
                  : "SaaS Core"}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
  return (
    <NavigationLoadingTarget.Provider value={navigationTarget}>
      {workspace}
    </NavigationLoadingTarget.Provider>
  );
}
