import { AppShell } from "@/components/layout/app-shell";
import { platformContext } from "@/features/platform/live/server";
export const dynamic = "force-dynamic";
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await platformContext();
  return (
    <AppShell key={context.principal.id} platformContext={context}>
      {children}
    </AppShell>
  );
}
