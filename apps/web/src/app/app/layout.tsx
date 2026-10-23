import { verifiedAccountEmail } from "@/lib/account-identity";
import { currentContext } from "@/lib/api";
import { AppShell } from "@/components/layout/app-shell";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await currentContext();
  return (
    <AppShell
      key={context.business.id}
      context={context}
      accountEmail={await verifiedAccountEmail()}
      showPreviews={process.env.NODE_ENV === "development"}
    >
      {children}
    </AppShell>
  );
}
