/**
 * Payment provider abstraction.
 * Set PAYMENT_PROVIDER=efi to route to Efí Bank instead of Asaas.
 * Defaults to Asaas (current production provider).
 */
import * as asaas from "@/lib/asaas";
import * as efi from "@/lib/efi";

function isEfi(): boolean {
  return process.env.PAYMENT_PROVIDER === "efi";
}

export const SERVICE_FEE_RATE = asaas.SERVICE_FEE_RATE;
export const ENTRY_FEE_SERVICE_RATE = asaas.ENTRY_FEE_SERVICE_RATE;

export const MIN_CHARGE_CENTS = isEfi()
  ? efi.EFI_MIN_CHARGE_CENTS
  : asaas.ASAAS_MIN_CHARGE_CENTS;

export type { PixPaymentResult } from "@/lib/asaas";

/** Returns the webhook route path for the active provider. */
export function getWebhookPath(): string {
  return isEfi() ? "/api/webhooks/efi" : "/api/webhooks/asaas";
}

export function createPixPayment(params: Parameters<typeof asaas.createPixPayment>[0]) {
  return isEfi() ? efi.createPixPayment(params) : asaas.createPixPayment(params);
}

export function sendPixDisbursement(params: Parameters<typeof asaas.sendPixDisbursement>[0]) {
  return isEfi() ? efi.sendPixDisbursement(params) : asaas.sendPixDisbursement(params);
}

export function getPaymentStatus(paymentId: string) {
  return isEfi() ? efi.getPaymentStatus(paymentId) : asaas.getPaymentStatus(paymentId);
}

export function getPaymentsByExternalReference(ref: string) {
  return isEfi()
    ? efi.getPaymentsByExternalReference(ref)
    : asaas.getPaymentsByExternalReference(ref);
}

export function refundPayment(paymentId: string, amountCents: number) {
  return isEfi()
    ? efi.refundPayment(paymentId, amountCents)
    : asaas.refundPayment(paymentId, amountCents);
}

export function getTransferStatus(transferId: string) {
  return isEfi() ? efi.getTransferStatus(transferId) : asaas.getTransferStatus(transferId);
}

export function normalizePaymentStatus(status: string): string {
  return isEfi() ? efi.normalizeEfiStatus(status) : asaas.normalizeAsaasStatus(status);
}
