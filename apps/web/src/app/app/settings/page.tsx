import type { Settings } from "@rental-fleet/contracts";

import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsForm } from "@/features/settings/settings-form";
export default async function ResourcePage() {
  const context = await currentContext();

  const initial = await api<Settings>("/settings");
  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Tùy chỉnh trải nghiệm cho doanh nghiệp."
      />
      <SettingsForm
        key={context.business.id}
        settings={initial}
        context={context}
      />
    </>
  );
}
