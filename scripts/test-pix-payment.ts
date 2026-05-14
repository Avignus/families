import { createPixPayment } from "../lib/asaas";

async function main() {
  const amountCents = parseInt(process.env.TEST_AMOUNT_CENTS ?? "500");
  const pix = await createPixPayment({
    amountCents,
    description: "Families — teste de cobrança PIX",
    payerSteamId: "test-steam-123",
    payerName: "Igor Teste",
    externalReference: "pledge:test-001",
    notificationUrl: "https://families.app/api/webhooks/asaas",
  });

  console.log("✅ PIX criado!");
  console.log("Payment ID:", pix.paymentId);
  console.log("Status:", pix.status);
  console.log("QR Code (primeiros 80 chars):", pix.qrCode.slice(0, 80) + "…");
  console.log("Tem imagem base64:", pix.qrCodeBase64.length > 0);
  console.log("Expira em:", pix.expiresAt.toISOString());
}

main().catch((err) => {
  console.error("❌ Erro:", err?.message ?? err);
  process.exit(1);
});
