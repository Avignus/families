import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { normalizeAsaasStatus } from "@/lib/asaas";
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

  // Timing-safe comparison prevents secret enumeration (ISO A.10.2.1)
  const token = req.headers.get("asaas-access-token") ?? "";
  const expectedToken = process.env.ASAAS_WEBHOOK_SECRET ?? "";
  if (!expectedToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let tokenValid = false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expectedToken);
    tokenValid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    tokenValid = false;
  }
  if (!tokenValid) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const paymentData = body.payment;
  if (!paymentData?.id) return NextResponse.json({ ok: true });

  const status = normalizeAsaasStatus(paymentData.status ?? "");
  const paymentId: string = paymentData.id;
  const externalRef: string = paymentData.externalReference ?? "";

  if (externalRef.startsWith("membership:")) {
    await handleMembershipPayment(externalRef.replace("membership:", ""), status, paymentId);
    return NextResponse.json({ ok: true });
  }

  if (externalRef.startsWith("spot:")) {
    await handleSpotPayment(externalRef.replace("spot:", ""), status, paymentId);
    return NextResponse.json({ ok: true });
  }

  if (externalRef.startsWith("credits:")) {
    const amountCents = Math.round((paymentData.value ?? 0) * 100);
    await handleCreditsPayment(externalRef.replace("credits:", ""), status, paymentId, amountCents);
    return NextResponse.json({ ok: true });
  }

  if (externalRef.startsWith("pledge:")) {
    await handlePledgePayment(externalRef.replace("pledge:", ""), paymentId, status);
  }

  return NextResponse.json({ ok: true });
}
