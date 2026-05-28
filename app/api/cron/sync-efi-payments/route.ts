import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getChargeByTxId, normalizeEfiStatus } from "@/lib/efi";
import {
  handleMembershipPayment,
  handleSpotPayment,
  handlePledgePayment,
} from "@/lib/payment-handlers";

export const dynamic = "force-dynamic";

const EFI_TXID_RE = /^[0-9a-f]{32}$/;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== "efi") {
    return NextResponse.json({ ok: true, skipped: "PAYMENT_PROVIDER is not efi" });
  }

  // Only look at charges created in the last 24h (Efí charges expire after 1h by default)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let processed = 0;
  const errors: string[] = [];

  // ── Memberships & spots ────────────────────────────────────────────────────
  const pendingMemberships = await prisma.familyMembership.findMany({
    where: {
      pixPaymentId: { not: null },
      pixStatus: "pending",
      joinedAt: { gte: cutoff },
    },
    select: { id: true, pixPaymentId: true },
  });

  for (const m of pendingMemberships) {
    const txid = m.pixPaymentId!;
    if (!EFI_TXID_RE.test(txid)) continue;
    try {
      const charge = await getChargeByTxId(txid);
      const refEntry = charge.infoAdicionais?.find((a: { nome: string }) => a.nome === "ref");
      const externalRef = refEntry?.valor ?? "";
      const status = normalizeEfiStatus(charge.status);

      if (externalRef.startsWith("membership:")) {
        await handleMembershipPayment(externalRef.replace("membership:", ""), status, txid);
        processed++;
      } else if (externalRef.startsWith("spot:")) {
        await handleSpotPayment(externalRef.replace("spot:", ""), status, txid);
        processed++;
      }
    } catch (e) {
      const msg = `membership txid ${txid}: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[sync-efi]", msg);
      errors.push(msg);
    }
  }

  // ── Pledges ────────────────────────────────────────────────────────────────
  const pendingPledges = await prisma.pledge.findMany({
    where: {
      pixPaymentId: { not: null },
      pixStatus: "pending",
      createdAt: { gte: cutoff },
    },
    select: { id: true, pixPaymentId: true },
  });

  for (const p of pendingPledges) {
    const txid = p.pixPaymentId!;
    if (!EFI_TXID_RE.test(txid)) continue;
    try {
      const charge = await getChargeByTxId(txid);
      const refEntry = charge.infoAdicionais?.find((a: { nome: string }) => a.nome === "ref");
      const externalRef = refEntry?.valor ?? "";
      const status = normalizeEfiStatus(charge.status);

      if (externalRef.startsWith("pledge:")) {
        await handlePledgePayment(externalRef.replace("pledge:", ""), txid, status);
        processed++;
      }
    } catch (e) {
      const msg = `pledge txid ${txid}: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[sync-efi]", msg);
      errors.push(msg);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: pendingMemberships.length + pendingPledges.length,
    processed,
    errors: errors.length ? errors : undefined,
  });
}
