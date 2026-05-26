import { NextRequest, NextResponse } from "next/server";
import { getChargeByTxId, normalizeEfiStatus } from "@/lib/efi";
import {
  handleMembershipPayment,
  handleSpotPayment,
  handleCreditsPayment,
  handlePledgePayment,
} from "@/lib/payment-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Efí sends a connectivity test ping (empty body or no pix array) during webhook registration.
  // Respond 200 immediately so the registration succeeds — no token needed for ping.
  if (!body.pix || !Array.isArray(body.pix) || body.pix.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Security: each txid is verified directly against the Efí API before any processing,
  // so a spoofed webhook cannot trigger state changes with fake data.
  for (const pixEvent of body.pix as Array<{
    txid?: string;
    endToEndId?: string;
    valor?: string;
  }>) {
    if (!pixEvent.txid) continue;

    try {
      const charge = await getChargeByTxId(pixEvent.txid);
      const refEntry = charge.infoAdicionais?.find((a) => a.nome === "ref");
      const externalRef = refEntry?.valor ?? "";
      const status = normalizeEfiStatus(charge.status);
      const paymentId = pixEvent.txid;

      if (externalRef.startsWith("membership:")) {
        await handleMembershipPayment(externalRef.replace("membership:", ""), status, paymentId);
      } else if (externalRef.startsWith("spot:")) {
        await handleSpotPayment(externalRef.replace("spot:", ""), status, paymentId);
      } else if (externalRef.startsWith("credits:")) {
        const amountCents = Math.round(parseFloat(pixEvent.valor ?? "0") * 100);
        await handleCreditsPayment(externalRef.replace("credits:", ""), status, paymentId, amountCents);
      } else if (externalRef.startsWith("pledge:")) {
        await handlePledgePayment(externalRef.replace("pledge:", ""), paymentId, status);
      }
    } catch (err) {
      console.error(`[efi-webhook] Error processing txid ${pixEvent.txid}:`, err);
    }
  }

  return NextResponse.json({ ok: true });
}
