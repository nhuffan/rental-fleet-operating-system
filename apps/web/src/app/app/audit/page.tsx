import { redirect } from "next/navigation";
import type { components } from "@rental-fleet/contracts/src/openapi";
import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { AuditPanel } from "@/features/tenant-audit/audit-panel";
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const context = await currentContext();
  if (!context.permissions.includes("audit.read")) redirect("/access-denied");
  const requested = Number((await searchParams).page ?? 1);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= 1000000
      ? requested
      : 1;
  const initial = await api<components["schemas"]["AuditPage"]>(
    `/audit-logs?page=${page}&limit=20`,
  );
  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Theo dõi các thay đổi trong doanh nghiệp."
      />
      <AuditPanel
        key={context.business.id}
        initial={initial}
        timezone={context.business.timezone}
      />
    </>
  );
}
