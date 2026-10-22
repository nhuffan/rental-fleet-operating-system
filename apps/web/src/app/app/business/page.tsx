import type { Business } from "@rental-fleet/contracts";

import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { BusinessProfile } from "@/features/business/business-profile";
export default async function ResourcePage() {
  const context = await currentContext();

  const initial = await api<Business>("/businesses/current");
  return (
    <>
      <PageHeader
        title="Doanh nghiệp"
        description="Hồ sơ và cấu hình không gian vận hành."
      />
      <BusinessProfile
        key={context.business.id}
        business={initial}
        context={context}
      />
    </>
  );
}
