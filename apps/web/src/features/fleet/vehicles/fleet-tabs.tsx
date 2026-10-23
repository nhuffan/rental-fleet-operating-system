import Link from "next/link";
export function FleetTabs({ active }: { active: "vehicles" | "devices" }) {
  return (
    <nav className="fleet-tabs" aria-label="Quản lý đội xe">
      <Link
        href="/app/vehicles"
        aria-current={active === "vehicles" ? "page" : undefined}
      >
        Xe
      </Link>
      <Link
        href="/app/vehicles/devices"
        aria-current={active === "devices" ? "page" : undefined}
      >
        Thiết bị GPS
      </Link>
    </nav>
  );
}
