// Quick sandbox test for MercadoPago PIX
// Usage: node scripts/test-pix.mjs

import { MercadoPagoConfig, Payment } from "mercadopago";

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "TEST-1665861932657916-051216-5dfb8604b5bc92dbb3fcdeec083f0c29-3129748298";

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

const AMOUNT_BRL = 5.00; // R$ 5,00
const PLEDGE_ID = "test-" + Date.now();

console.log(`\nTestando PIX sandbox — R$ ${AMOUNT_BRL.toFixed(2)}`);
console.log(`Access token: ${ACCESS_TOKEN.slice(0, 20)}...`);

try {
  const result = await payment.create({
    body: {
      transaction_amount: AMOUNT_BRL,
      description: "Families — Teste PIX sandbox",
      payment_method_id: "pix",
      payer: { email: `steam.test@families.app` },
      notification_url: "https://families-flax.vercel.app/api/webhooks/mercadopago",
      external_reference: PLEDGE_ID,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    },
  });

  console.log("\n✓ Pagamento criado com sucesso!");
  console.log(`  ID: ${result.id}`);
  console.log(`  Status: ${result.status}`);
  console.log(`  Status detail: ${result.status_detail}`);

  const txData = result.point_of_interaction?.transaction_data;
  if (txData?.qr_code) {
    console.log(`\n  PIX Copia e Cola:`);
    console.log(`  ${txData.qr_code}`);
    console.log(`\n  Ticket URL: ${txData.ticket_url}`);
    console.log(`  QR Base64: ${txData.qr_code_base64 ? "✓ disponível (" + txData.qr_code_base64.length + " chars)" : "✗ ausente"}`);
  } else {
    console.log("\n  ✗ QR code ausente na resposta");
    console.log("  Resposta completa:", JSON.stringify(result, null, 2));
  }

} catch (err) {
  console.error("\n✗ Erro ao criar pagamento:");
  console.error(err?.message ?? err);
  if (err?.cause) console.error("Causa:", JSON.stringify(err.cause, null, 2));
  process.exit(1);
}
