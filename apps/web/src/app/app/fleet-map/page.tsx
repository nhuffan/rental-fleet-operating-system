import { notFound } from "next/navigation";
import { currentContext } from "@/lib/api";
export default async function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  await currentContext();
  const { FleetPreview } = await import("@/features/fleet/fleet-preview");
  return (
    <>
      <div className="preview-banner">
        <strong>
          Dữ liệu minh họa · Không phải dữ liệu doanh nghiệp hiện tại. Chỉ có
          trong development.
        </strong>
      </div>
      <FleetPreview screen="fleet-map" />
    </>
  );
}
