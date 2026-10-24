"use client";
import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PlatformMe } from "@/features/platform/live/types";
import type { Me } from "@rental-fleet/contracts";
import { BusinessSwitcher } from "@/app/app/shell-controls";
import { UserAccountMenu } from "./user-account-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
const compactNavigationQuery = "(max-height: 960px)";
function subscribeNavigationSize(onChange: () => void) {
  const query = window.matchMedia(compactNavigationQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const navigationIsCompact = () =>
  window.matchMedia(compactNavigationQuery).matches;
const serverNavigationIsCompact = () => false;

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
  const compactNavigation = useSyncExternalStore(
    subscribeNavigationSize,
    navigationIsCompact,
    serverNavigationIsCompact,
  );
  const [navigationChoice, setNavigationChoice] = useState<{
    path: string;
    group: string | null;
  } | null>(null);
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
                    : true),
        )
        .map(([path, label, icon]) => ({
          href: prefix + (path ? `/${path}` : ""),
          label,
          icon,
          unavailable:
            !preview && !["", "businesses", "users", "audit"].includes(path),
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
      <Link
        key={item.href}
        href={item.href}
        className={`nav-link ${pathname === item.href || (["/app/vehicles", "/app/rentals", "/app/customers", "/app/trips", "/app/commercial", "/superadmin/businesses", "/superadmin/users"].includes(item.href) && pathname.startsWith(`${item.href}/`)) ? "is-active" : ""}`}
        aria-current={
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
            ? "page"
            : undefined
        }
        onClick={() => setOpen(false)}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {item.preview && <small>Preview</small>}
        {item.unavailable && <small>Chưa có</small>}
      </Link>
    ));
  }
  const activeNavigationGroup = management.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
    ? "management"
    : "core";
  const expandedNavigationGroup =
    navigationChoice?.path === pathname
      ? navigationChoice.group
      : activeNavigationGroup;
  function navigationGroup(
    group: string,
    title: string,
    label: string,
    items: NavItem[],
  ) {
    const expanded = !compactNavigation || expandedNavigationGroup === group;
    return (
      <section className="sidebar-group" key={group}>
        {compactNavigation ? (
          <button
            className="nav-label nav-group-toggle"
            type="button"
            aria-expanded={expanded}
            aria-controls={`sidebar-group-${group}`}
            onClick={() =>
              setNavigationChoice({
                path: pathname,
                group: expanded ? null : group,
              })
            }
          >
            <span>{title}</span>
            <Icon name="chevron" size={14} />
          </button>
        ) : (
          <div className="nav-label">{title}</div>
        )}
        <nav
          id={`sidebar-group-${group}`}
          aria-label={label}
          className="sidebar-nav"
          hidden={!expanded}
        >
          {nav(items)}
        </nav>
      </section>
    );
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
        {/* Stable intrinsic sizing includes every live label, even when a group is collapsed. */}
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
              {["features", "integrations"].includes(path) && (
                <small>Chưa có</small>
              )}
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
              <div className="platform-context">
                <Icon name="globe" />
                <span>Platform Console</span>
                {preview && <small>Preview</small>}
              </div>
            ) : context ? (
              <BusinessSwitcher
                businesses={context.businesses}
                selected={context.business.id}
              />
            ) : (
              <div className="platform-context" title="Doanh nghiệp minh họa">
                <Icon name="business" />
                <span>Minh An Mobility</span>
                <small>Preview</small>
              </div>
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
            settingsHref={`${prefix}/settings`}
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
            {children}
          </main>
          <footer className="workspace-footer">
            <span>Rental Fleet OS</span>
            <span>
              {platform
                ? "Quản trị nền tảng"
                : "Không gian vận hành doanh nghiệp"}{" "}
              ·{" "}
              {preview
                ? "Design preview"
                : platform
                  ? "Dữ liệu trực tiếp · Chỉ đọc"
                  : "SaaS Core"}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
