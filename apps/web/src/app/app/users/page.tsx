import type { Membership, Page } from "@rental-fleet/contracts";
import { redirect } from "next/navigation";
import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { MembersPanel } from "@/features/memberships/members-panel";
export default async function ResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const context = await currentContext();
  if (!context.permissions.includes("user.read")) redirect("/access-denied");
  const requested = Number((await searchParams).page ?? 1);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= 1000000
      ? requested
      : 1;
  const initial = await api<Page<Membership>>(
    `/memberships?page=${page}&limit=20`,
  );
  return (
    <>
      <PageHeader
        title="Quyền truy cập Owner"
        description="Quản lý các Owner được toàn quyền truy cập doanh nghiệp."
      />
      <MembersPanel
        key={context.business.id}
        initial={initial}
        context={context}
      />
    </>
  );
}
