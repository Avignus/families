/**
 * One-time setup: registers the webhook URL with Efí Bank for the configured PIX key.
 * Must be run once after first deploy with PAYMENT_PROVIDER=efi.
 *
 * Usage:
 *   EFI_SANDBOX=1 npx ts-node scripts/register-efi-webhook.ts https://yourapp.com
 *   (production — omit EFI_SANDBOX):
 *   npx ts-node scripts/register-efi-webhook.ts https://yourapp.com
 */
import "dotenv/config";
import { registerEfiWebhook } from "../lib/efi";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: ts-node register-efi-webhook.ts <baseUrl>");
  console.error("  e.g. ts-node register-efi-webhook.ts https://families.app");
  process.exit(1);
}

const secret = process.env.EFI_WEBHOOK_SECRET;
if (!secret) {
  console.error("EFI_WEBHOOK_SECRET env var not set");
  process.exit(1);
}

const webhookUrl = `${baseUrl}/api/webhooks/efi`;
console.log("Registering Efí webhook:", webhookUrl);

registerEfiWebhook(webhookUrl)
  .then(() => console.log("Webhook registered successfully"))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
