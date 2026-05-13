import MercadoPagoConfig, { Payment } from "mercadopago";

export const SERVICE_FEE_RATE = parseFloat(process.env.SERVICE_FEE_RATE ?? "0.05");
export const ENTRY_FEE_SERVICE_RATE = parseFloat(process.env.ENTRY_FEE_SERVICE_RATE ?? "0.15");

let _client: MercadoPagoConfig | null = null;

function getClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
    });
  }
  return _client;
}

export type PixPaymentResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  status: string;
  expiresAt: Date;
};

export async function createPixPayment(params: {
  amountCents: number;
  description: string;
  payerSteamId: string;
  pledgeId: string;
  notificationUrl: string;
}): Promise<PixPaymentResult> {
  const payment = new Payment(getClient());

  const amount = params.amountCents / 100;
  // MercadoPago requires a payer email — we generate a deterministic one from the Steam ID
  const payerEmail = `steam.${params.payerSteamId}@families.app`;

  const isPublicUrl = params.notificationUrl.startsWith("https://");

  const result = await payment.create({
    body: {
      transaction_amount: amount,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      ...(isPublicUrl ? { notification_url: params.notificationUrl } : {}),
      external_reference: params.pledgeId,
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  if (!result.id) throw new Error("MercadoPago não retornou ID do pagamento");

  const txData = result.point_of_interaction?.transaction_data;
  if (!txData?.qr_code) throw new Error("MercadoPago não retornou QR code PIX");

  const isSandbox = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-");

  return {
    paymentId: String(result.id),
    qrCode: txData.qr_code,
    qrCodeBase64: txData.qr_code_base64 ?? "",
    ticketUrl: isSandbox ? "" : (txData.ticket_url ?? ""),
    status: result.status ?? "pending",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

export async function sendPixDisbursement(params: {
  amountCents: number;
  pixKey: string;
  description: string;
}): Promise<string> {
  const amount = params.amountCents / 100;
  const res = await fetch("https://api.mercadopago.com/v1/account/bank_transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      origin_account_type: "mp",
      destination: { type: "pix", pix_key: params.pixKey },
      description: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Disbursement failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return String(data.id);
}

export async function getPaymentStatus(mpPaymentId: string): Promise<string | null> {
  try {
    const payment = new Payment(getClient());
    const result = await payment.get({ id: Number(mpPaymentId) });
    return result.status ?? null;
  } catch {
    return null;
  }
}

// Partial refund — refunds only entryFeeCents, platform keeps service fee
export async function refundEntryFee(mpPaymentId: string, entryFeeCents: number): Promise<void> {
  const amount = entryFeeCents / 100;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Refund failed: ${JSON.stringify(err)}`);
  }
}

// Verifies the X-Signature header from MercadoPago webhooks
export function verifyWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if secret not configured

  const { xSignature, xRequestId, dataId } = params;
  const parts = Object.fromEntries(xSignature.split(",").map((p) => p.split("=")));
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hmac === v1;
}
