import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { apiRange, isExportKind, reportFilters } from "@/features/reports/period";
import { publicEnv } from "@/lib/env";
import { verifiedServerAuth } from "@/lib/server-auth";

// Proxies the authorized CSV so the bearer token never reaches the browser URL.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!isExportKind(kind))
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const auth = await verifiedServerAuth();
  if (!auth) return NextResponse.redirect(new URL("/login", request.url));
  const search = request.nextUrl.searchParams;
  const range = apiRange(
    reportFilters({
      from: search.get("from") ?? undefined,
      until: search.get("until") ?? undefined,
    }),
  );
  const business = (await cookies()).get("current-business")?.value;
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1/reports/export/${kind}?from=${encodeURIComponent(range.from)}&until=${encodeURIComponent(range.until)}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        ...(business ? { "X-Business-Id": business } : {}),
      },
    },
  );
  if (!response.ok)
    return NextResponse.json(
      { code: response.status === 422 ? "REPORT_ROW_LIMIT" : "EXPORT_FAILED" },
      { status: response.status === 403 ? 403 : response.status === 422 ? 422 : 502 },
    );
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${range.from.slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
