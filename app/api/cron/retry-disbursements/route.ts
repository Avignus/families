import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { maybeDisburseFunds } from "@/lib/disbursement";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) return NextResponse.json({ ok: false }, { status: 401 });

  // Find funded items with no disbursement where all pledges are paid
  const candidates = await prisma.wishlistItem.findMany({
    where: {
      status: "funded",
      disbursedAt: null,
      owner: { pixKey: { not: null } },
    },
    select: {
      id: true,
      familyId: true,
      steamAppId: true,
      owner: { select: { personaName: true, pixKey: true } },
      pledges: {
        where: { status: "active" },
        select: { paidAt: true, amountCents: true },
      },
    },
  });

  const results: Array<{ itemId: string; owner: string; status: string }> = [];

  for (const item of candidates) {
    const allPaid = item.pledges.length > 0 && item.pledges.every((p) => p.paidAt !== null);
    if (!allPaid) {
      results.push({ itemId: item.id, owner: item.owner?.personaName ?? "?", status: "skipped_unpaid_pledges" });
      continue;
    }

    try {
      await maybeDisburseFunds(item.id);
      const updated = await prisma.wishlistItem.findUnique({
        where: { id: item.id },
        select: { disbursedAt: true },
      });
      results.push({
        itemId: item.id,
        owner: item.owner?.personaName ?? "?",
        status: updated?.disbursedAt ? "disbursed" : "insufficient_balance",
      });
    } catch (e) {
      console.error(`Retry disbursement failed for item ${item.id}:`, e);
      results.push({ itemId: item.id, owner: item.owner?.personaName ?? "?", status: "error" });
    }
  }

  return NextResponse.json({ ok: true, checked: candidates.length, results });
}
