import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { PortalMe } from "./types";

// Customer identity is independently verified by NestJS. This helper never reads
// the business cookie, never sends X-Business-Id and only reaches /portal/* routes.
export async function portalApi<T>(
  path: string,
  options: { notFoundOn404?: boolean } = {},
): Promise<T> {
  if (!path.startsWith("/portal/"))
    throw new Error("Invalid portal API path");
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/portal");
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) redirect("/login?next=/portal");
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1${path}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (response.status === 401) redirect("/login?next=/portal");
  if (response.status === 403) redirect("/access-denied");
  if (response.status === 404 && options.notFoundOn404) notFound();
  if (!response.ok) throw new Error("Không thể tải dữ liệu. Vui lòng thử lại.");
  return response.json() as Promise<T>;
}
export const portalContext = cache(() => portalApi<PortalMe>("/portal/me"));
