import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Me } from "@rental-fleet/contracts";
import { verifiedServerAuth } from "./server-auth";
import { publicEnv } from "./env";
export class ApiResponseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super("Không thể tải dữ liệu. Vui lòng thử lại.");
    this.name = "ApiResponseError";
  }
}
export async function api<T>(
  path: string,
  options: { notFoundOn404?: boolean } = {},
): Promise<T> {
  const auth = await verifiedServerAuth();
  if (!auth) redirect("/login");
  const business = (await cookies()).get("current-business")?.value;
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1${path}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        ...(business ? { "X-Business-Id": business } : {}),
      },
    },
  );
  if (response.status === 401) redirect("/login");
  if (response.status === 403) redirect("/access-denied");
  if (response.status === 404 && options.notFoundOn404) notFound();
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const rawCode =
      body && typeof body === "object" && "code" in body ? body.code : null;
    const code =
      typeof rawCode === "string" && /^[A-Z0-9_]{1,80}$/.test(rawCode)
        ? rawCode
        : "API_ERROR";
    throw new ApiResponseError(response.status, code);
  }
  return response.json() as Promise<T>;
}
export const currentContext = cache(() => api<Me>("/me"));
