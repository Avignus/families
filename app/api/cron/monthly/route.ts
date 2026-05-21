import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { getAppBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTHLY_ROUTES = ["/api/cron/auto-distribute"];


export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) return NextResponse.json({ ok: false }, { status: 401 });

  const baseUrl = getAppBaseUrl(req);
  const secret = process.env.CRON_SECRET!;

  const results = await Promise.allSettled(
    MONTHLY_ROUTES.map((route) =>
      fetch(`${baseUrl}${route}`, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(240_000),
      }).then((r) => r.json())
    )
  );

  return NextResponse.json({
    ok: true,
    results: results.map((r, i) => ({
      route: MONTHLY_ROUTES[i],
      status: r.status,
      ...(r.status === "fulfilled" ? { data: r.value } : { error: String(r.reason) }),
    })),
  });
}
