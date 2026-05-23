import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Verify token
  const token = req.headers.get("asaas-access-token") ?? "";
  const expected = process.env.ASAAS_TRANSFER_AUTH_SECRET ?? "";
  if (!expected) {
    return NextResponse.json({ status: "REFUSED", refuseReason: "Auth not configured" }, { status: 401 });
  }
  let valid = false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch { valid = false; }
  if (!valid) {
    return NextResponse.json({ status: "REFUSED", refuseReason: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ status: "REFUSED", refuseReason: "Invalid payload" });

  // Only auto-approve disbursement transfers (PIX transfers we initiated)
  if (body.type === "TRANSFER" && body.transfer?.id) {
    const transferId = body.transfer.id;

    // Confirm this transfer was created by our disbursement system
    const item = await prisma.wishlistItem.findFirst({
      where: { disbursementMpId: transferId },
    });

    if (item) {
      return NextResponse.json({ status: "APPROVED" });
    }

    return NextResponse.json({ status: "REFUSED", refuseReason: "Transfer not found in disbursement records" });
  }

  // Deny anything else (PIX_REFUND, BILL, etc.) — let those go through normal flow
  return NextResponse.json({ status: "REFUSED", refuseReason: "Not a managed disbursement" });
}
