import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Superadmin({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  // No platform principal exists. This route never grants platform access to tenant roles.
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen = [] } = await params;
  redirect(
    `/dev-preview/platform${screen.length ? "/" + screen.map(encodeURIComponent).join("/") : ""}`,
  );
}
