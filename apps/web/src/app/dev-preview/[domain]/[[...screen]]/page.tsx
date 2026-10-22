import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Icon } from "@/components/ui/icon";
export const dynamic = "force-dynamic";
export default async function DesignPreview({
  params,
}: {
  params: Promise<{ domain: string; screen?: string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { domain, screen = [] } = await params;
  if (domain !== "business" && domain !== "platform") notFound();
  const section = screen[0] ?? "dashboard";
  const allowed =
    domain === "business"
      ? [
          "dashboard",
          "vehicles",
          "rentals",
          "customers",
          "fleet-map",
          "trips",
          "commercial",
          "business",
          "users",
          "branches",
          "settings",
          "audit",
        ]
      : [
          "dashboard",
          "businesses",
          "users",
          "features",
          "integrations",
          "audit",
          "settings",
        ];
  if (
    !allowed.includes(section) ||
    (screen.length > 1 &&
      (domain !== "platform" ||
        section !== "businesses" ||
        screen.length !== 2))
  )
    notFound();
  let content;
  if (domain === "platform") {
    if (
      screen[1] &&
      !(await import("@/features/platform/fixtures")).businesses.some(
        (b) => b.id === screen[1],
      )
    )
      notFound();
    const { PlatformPreview } =
      await import("@/features/platform/platform-preview");
    content = (
      <PlatformPreview
        key={screen.join("/")}
        screen={section}
        businessId={screen[1]}
      />
    );
  } else if (
    ["business", "users", "branches", "settings", "audit"].includes(section)
  ) {
    const { CorePreview } = await import("@/features/business/core-preview");
    content = <CorePreview key={section} screen={section} />;
  } else {
    const { FleetPreview } = await import("@/features/fleet/fleet-preview");
    content = <FleetPreview key={section} screen={section} />;
  }
  return (
    <AppShell previewDomain={domain}>
      <div className="preview-banner">
        <div className="inline">
          <Icon name="alert" size={16} />
          <span>
            <strong>Dữ liệu minh họa.</strong> Chỉ dùng thiết kế trong
            development. Không phải dữ liệu production; các thao tác ghi chưa có
            API bị khóa.
          </span>
        </div>
        <Link href="/app">Về workspace thật →</Link>
      </div>
      {content}
    </AppShell>
  );
}
