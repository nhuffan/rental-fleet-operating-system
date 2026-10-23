import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { platformLoginPath } from "@/lib/auth-navigation";
import type { PlatformMe } from "./types";
// Platform identity is independently verified by NestJS. This helper deliberately
// never reads the business cookie, sends X-Business-Id or calls tenant /me.
export async function platformApi<T>(
  path: string,
  returnPath = "/superadmin",
  options: { notFoundOn404?: boolean } = {},
): Promise<T> {
  if (!path.startsWith("/platform/"))
    throw new Error("Invalid platform API path");
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(platformLoginPath(returnPath));
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) redirect(platformLoginPath(returnPath));
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1${path}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (response.status === 401) redirect(platformLoginPath(returnPath));
  if (response.status === 403) redirect("/access-denied?scope=platform");
  if (response.status === 404 && options.notFoundOn404) notFound();
  if (!response.ok)
    throw new Error("Không thể tải dữ liệu nền tảng. Vui lòng thử lại.");
  return response.json() as Promise<T>;
}
export const platformContext = cache(() =>
  platformApi<PlatformMe>("/platform/me"),
);
export async function requirePlatformPermission(
  permission: "platform.overview.read" | "platform.business.read",
) {
  const context = await platformContext();
  if (!context.permissions.includes(permission))
    redirect("/access-denied?scope=platform");
  return context;
}
