import type { Branch, Page } from "@rental-fleet/contracts";

import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { BranchesPanel } from "@/features/branches/branches-panel";
export default async function ResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const context = await currentContext();
  const requested = Number((await searchParams).page ?? 1);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= 1000000
      ? requested
      : 1;
  const initial = await api<Page<Branch>>(`/branches?page=${page}&limit=20`);
  return (
    <>
      <PageHeader
        title="Chi nhánh"
        description="Tất cả điểm vận hành trong doanh nghiệp của bạn."
      />
      <BranchesPanel
        key={context.business.id}
        initial={initial}
        context={context}
      />
    </>
  );
}
