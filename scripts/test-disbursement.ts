import { sendPixDisbursement } from "../lib/asaas";

const PIX_KEY = process.env.TEST_PIX_KEY ?? "+5531986799101";
const AMOUNT_CENTS = parseInt(process.env.TEST_AMOUNT_CENTS ?? "100"); // R$ 1,00

async function main() {
  const apiKey = process.env.ASAAS_API_KEY ?? "";
  if (!apiKey) {
    console.error("❌ Defina ASAAS_API_KEY antes de rodar.");
    process.exit(1);
  }

  const isSandbox = apiKey.includes("_hmlg_") || apiKey.startsWith("$aas_test") || apiKey.startsWith("$aas_sandbox");
  console.log(`Ambiente: ${isSandbox ? "sandbox" : "produção"}`);
  console.log(`Enviando R$ ${(AMOUNT_CENTS / 100).toFixed(2)} para PIX: ${PIX_KEY}`);

  const transferId = await sendPixDisbursement({
    amountCents: AMOUNT_CENTS,
    pixKey: PIX_KEY,
    description: "Families — teste de repasse",
  });

  console.log(`✅ Repasse enviado! ID Asaas: ${transferId}`);
}

main().catch((err) => {
  console.error("❌ Erro:", err?.message ?? err);
  process.exit(1);
});
