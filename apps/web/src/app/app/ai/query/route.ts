import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { verifiedServerAuth } from "@/lib/server-auth";

// Same-origin proxy: the bearer token and selected business stay server-side.
// Only the question is forwarded; the browser never chooses a tenant or tool.
export async function POST(request: NextRequest) {
  const auth = await verifiedServerAuth();
  if (!auth) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const question =
    body && typeof body === "object" && "question" in body
      ? (body as { question: unknown }).question
      : null;
  if (typeof question !== "string" || !question.trim() || question.length > 500)
    return NextResponse.json({ code: "VALIDATION_ERROR" }, { status: 400 });
  const business = (await cookies()).get("current-business")?.value;
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? publicEnv().api}/api/v1/ai/query`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        ...(business ? { "X-Business-Id": business } : {}),
      },
      body: JSON.stringify({ question: question.trim() }),
    },
  ).catch(() => null);
  if (!response)
    return NextResponse.json({ code: "AI_UNAVAILABLE" }, { status: 503 });
  if (response.ok)
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  const error: unknown = await response.json().catch(() => null);
  const raw =
    error && typeof error === "object" && "code" in error
      ? (error as { code: unknown }).code
      : null;
  const code =
    typeof raw === "string" && /^[A-Z0-9_]{1,80}$/.test(raw) ? raw : "AI_ERROR";
  return NextResponse.json({ code }, { status: response.status });
}
