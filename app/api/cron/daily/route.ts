import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAILY_ROUTES = [
  "/api/cron/price-sync",
  "/api/cron/retry-disbursements",
  "/api/cron/refund-stuck-pledges",
  "/api/cron/opportunity-notifications",
];

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const baseUrl = getAppBaseUrl(req);
  const secret = process.env.CRON_SECRET!;

  const results = await Promise.allSettled(
    DAILY_ROUTES.map((route) =>
      fetch(`${baseUrl}${route}`, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(240_000),
      }).then((r) => r.json())
    )
  );

  return NextResponse.json({
    ok: true,
    results: results.map((r, i) => ({
      route: DAILY_ROUTES[i],
      status: r.status,
      ...(r.status === "fulfilled" ? { data: r.value } : { error: String(r.reason) }),
    })),
  });
}
