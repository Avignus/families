import MercadoPagoConfig, { Payment } from "mercadopago";

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

  const result = await payment.create({
    body: {
      transaction_amount: amount,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      notification_url: params.notificationUrl,
      external_reference: params.pledgeId,
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
    },
  });

  if (!result.id) throw new Error("MercadoPago não retornou ID do pagamento");

  const txData = result.point_of_interaction?.transaction_data;
  if (!txData?.qr_code) throw new Error("MercadoPago não retornou QR code PIX");

  return {
    paymentId: String(result.id),
    qrCode: txData.qr_code,
    qrCodeBase64: txData.qr_code_base64 ?? "",
    ticketUrl: txData.ticket_url ?? "",
    status: result.status ?? "pending",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
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
