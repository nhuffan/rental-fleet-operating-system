import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Me } from "@rental-fleet/contracts";
import { serverClient } from "./supabase/server";
import { publicEnv } from "./env";
export async function api<T>(
  path: string,
  options: { notFoundOn404?: boolean } = {},
): Promise<T> {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const business = (await cookies()).get("current-business")?.value;
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1${path}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(business ? { "X-Business-Id": business } : {}),
      },
    },
  );
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/access-denied");
  if (response.status === 404 && options.notFoundOn404) notFound();
  if (!response.ok) throw new Error("Không thể tải dữ liệu. Vui lòng thử lại.");
  return response.json() as Promise<T>;
}
export const currentContext = cache(() => api<Me>("/me"));
