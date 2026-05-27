/**
 * Registers the Efí webhook URL (Cloudflare Worker proxy) for the configured PIX key.
 *
 * Usage:
 *   npx ts-node scripts/register-efi-webhook.ts https://efi-webhook-proxy.YOUR_ACCOUNT.workers.dev
 */
import "dotenv/config";
import { registerEfiWebhook } from "../lib/efi";

const workerUrl = process.argv[2];
if (!workerUrl) {
  console.error("Usage: ts-node scripts/register-efi-webhook.ts <cloudflare-worker-url>");
  console.error("  e.g. npx ts-node scripts/register-efi-webhook.ts https://efi-webhook-proxy.myaccount.workers.dev");
  process.exit(1);
}

console.log("Registering Efí webhook →", workerUrl);

registerEfiWebhook(workerUrl)
  .then(() => console.log("✓ Webhook registered successfully"))
  .catch((err) => {
    console.error("✗ Failed:", err.message);
    process.exit(1);
  });
