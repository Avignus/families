/**
 * Smoke test para validar a integração com o Efí Bank em sandbox.
 * Executa: criar cobrança → gerar QR code → consultar status
 *
 * Uso:
 *   npx ts-node scripts/test-efi.ts
 *
 * Variáveis necessárias (no .env.local ou exportadas):
 *   EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_CERT_B64, EFI_PIX_KEY
 *   EFI_SANDBOX=1
 */

// Carrega .env.local antes de tudo
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createPixPayment, getPaymentStatus } from "../lib/efi";

const required = ["EFI_CLIENT_ID", "EFI_CLIENT_SECRET", "EFI_CERT_B64", "EFI_PIX_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Variáveis ausentes:", missing.join(", "));
  process.exit(1);
}

if (process.env.EFI_SANDBOX !== "1") {
  console.warn("⚠️  EFI_SANDBOX não está ativo — isso vai usar produção!");
}

console.log("🔌 Testando Efí Bank...");
console.log("   Sandbox:", process.env.EFI_SANDBOX === "1" ? "SIM" : "NÃO");
console.log("   PIX key:", process.env.EFI_PIX_KEY);
console.log("");

async function main() {
  // 1. Criar cobrança de R$ 10,00
  console.log("1️⃣  Criando cobrança PIX de R$ 10,00...");
  const result = await createPixPayment({
    amountCents: 1000,
    description: "Teste Families — smoke test",
    payerSteamId: "test_steam_id",
    payerName: "Teste Dev",
    externalReference: `test:${Date.now()}`,
    notificationUrl: "https://example.com/webhook",
  });

  console.log("   ✅ Cobrança criada!");
  console.log("   txid:", result.paymentId);
  console.log("   status:", result.status);
  console.log("   expira em:", result.expiresAt.toISOString());
  console.log("   QR code (primeiros 60 chars):", result.qrCode.slice(0, 60) + "...");
  console.log("   QR base64 presente:", result.qrCodeBase64.length > 0 ? "SIM" : "NÃO");
  console.log("");

  // 2. Consultar status
  console.log("2️⃣  Consultando status da cobrança...");
  const status = await getPaymentStatus(result.paymentId);
  console.log("   ✅ Status:", status);
  console.log("");

  console.log("✅ Integração Efí Bank funcionando corretamente em sandbox!");
  console.log("");
  console.log("Próximos passos:");
  console.log("  1. Registrar webhook:");
  console.log("     npx ts-node scripts/register-efi-webhook.ts https://sua-url.vercel.app");
  console.log("  2. Remover EFI_SANDBOX e setar PAYMENT_PROVIDER=efi em produção");
}

main().catch((err) => {
  console.error("❌ Erro:", err.message ?? err);
  process.exit(1);
});
