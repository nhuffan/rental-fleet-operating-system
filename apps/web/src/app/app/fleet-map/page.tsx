import { api, currentContext } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { LiveFleetMap } from "@/features/telematics/gps/live-fleet-map";
import type { LocationPage } from "@/features/telematics/gps/types";
export default async function FleetMapPage() {
  const c = await currentContext();
  if (!c.permissions.includes("gps.read"))
    return <EmptyState title="Bạn không có quyền xem vị trí GPS" />;
  const initial = await api<LocationPage>("/fleet/locations?limit=20");
  return (
    <>
      <PageHeader
        title="Bản đồ đội xe"
        description="Vị trí gần nhất theo thiết bị đang gắn. TEST feed phục vụ kiểm chứng tích hợp, chưa xác minh thiết bị thực tế."
      />
      <LiveFleetMap
        key={c.business.id}
        businessId={c.business.id}
        initial={initial}
      />
    </>
  );
}
