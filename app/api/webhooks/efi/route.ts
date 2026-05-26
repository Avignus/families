import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getChargeByTxId, normalizeEfiStatus } from "@/lib/efi";
import {
  handleMembershipPayment,
  handleSpotPayment,
  handleCreditsPayment,
  handlePledgePayment,
} from "@/lib/payment-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Efí doesn't send a signature — secure via secret token in registered webhook URL
  // Register the webhook with: PUT /v2/webhook/{chave} → webhookUrl including ?token=EFI_WEBHOOK_SECRET
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = process.env.EFI_WEBHOOK_SECRET ?? "";
  if (!expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let valid = false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Efí sends a connectivity test with an empty body or no pix array — acknowledge it
  if (!body.pix || !Array.isArray(body.pix) || body.pix.length === 0) {
    return NextResponse.json({ ok: true });
  }

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
