export const SERVICE_FEE_RATE = parseFloat(process.env.SERVICE_FEE_RATE ?? "0.15");
export const ENTRY_FEE_SERVICE_RATE = parseFloat(process.env.ENTRY_FEE_SERVICE_RATE ?? "0.15");
export const ASAAS_MIN_CHARGE_CENTS = 2000; // R$ 20,00 mínimo para cobrir taxa fixa Asaas (R$1,99)

type AsaasPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type PixPaymentResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  status: string;
  expiresAt: Date;
};

function getBaseUrl(): string {
  let key = "";
  try { key = getApiKey(); } catch {}
  const isSandbox = key.includes("_hmlg_") || key.startsWith("$aas_test") || key.startsWith("$aas_sandbox");
  return isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
}

function getApiKey(): string {
  // ASAAS_API_KEY_B64 is the base64-encoded key (avoids $ expansion issues in some environments)
  const b64 = process.env.ASAAS_API_KEY_B64;
  if (b64) return Buffer.from(b64, "base64").toString("utf-8");
  const raw = process.env.ASAAS_API_KEY;
  if (raw) return raw;
  throw new Error("ASAAS_API_KEY não configurada");
}

async function asaasRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Asaas API error ${res.status}: ${JSON.stringify(body)}`);
  }

  return res.json() as Promise<T>;
}

async function getOrCreateCustomer(steamId: string, name: string): Promise<string> {
  // If a default platform customer is configured, use it for all charges.
  // This avoids requiring individual CPF/CNPJ from Steam users.
  const defaultCustomerId = process.env.ASAAS_DEFAULT_CUSTOMER_ID;
  if (defaultCustomerId) return defaultCustomerId;

  const externalRef = `steam:${steamId}`;
  const search = await asaasRequest<{ data: { id: string }[] }>(
    `/customers?externalReference=${encodeURIComponent(externalRef)}`
  );
  if (search.data?.length > 0) return search.data[0].id;

  const cpfCnpj = process.env.ASAAS_CUSTOMER_CPF_CNPJ;
  const customer = await asaasRequest<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: name || `Steam ${steamId}`,
      email: `steam.${steamId}@families.app`,
      externalReference: externalRef,
      ...(cpfCnpj ? { cpfCnpj } : {}),
    }),
  });
  return customer.id;
}

export function normalizeAsaasStatus(status: string): string {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
      return "approved";
    case "PENDING":
      return "pending";
    case "OVERDUE":
    case "DELETED":
      return "cancelled";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "refunded";
    default:
      return status.toLowerCase();
  }
}

export async function createPixPayment(params: {
  amountCents: number;
  description: string;
  payerSteamId: string;
  payerName: string;
  externalReference: string;
  notificationUrl: string;
}): Promise<PixPaymentResult> {
  const customerId = await getOrCreateCustomer(params.payerSteamId, params.payerName);
  const value = params.amountCents / 100;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const payment = await asaasRequest<{ id: string; status: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value,
      dueDate,
      description: params.description,
      externalReference: params.externalReference,
      notificationUrl: params.notificationUrl,
    }),
  });

  const qrData = await asaasRequest<{ payload: string; encodedImage: string }>(
    `/payments/${payment.id}/pixQrCode`
  );

  return {
    paymentId: payment.id,
    qrCode: qrData.payload ?? "",
    qrCodeBase64: qrData.encodedImage ?? "",
    ticketUrl: "",
    status: normalizeAsaasStatus(payment.status),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

export async function getPaymentsByExternalReference(externalRef: string): Promise<Array<{ id: string; status: string; value: number }>> {
  try {
    const res = await asaasRequest<{ data: Array<{ id: string; status: string; value: number }> }>(
      `/payments?externalReference=${encodeURIComponent(externalRef)}`
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function getPaymentStatus(paymentId: string): Promise<string | null> {
  try {
    const payment = await asaasRequest<{ status: string }>(`/payments/${paymentId}`);
    return normalizeAsaasStatus(payment.status);
  } catch {
    return null;
  }
}

export async function refundPayment(paymentId: string, amountCents: number): Promise<void> {
  await asaasRequest(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ value: amountCents / 100 }),
  });
}

// --- PIX disbursement (outgoing transfer to user) ---

function inferAsaasKeyType(pixKey: string): { key: string; type: AsaasPixKeyType } {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pixKey)) {
    return { key: pixKey, type: "EVP" };
  }
  if (pixKey.includes("@")) return { key: pixKey, type: "EMAIL" };
  if (pixKey.startsWith("+55")) return { key: pixKey.slice(3), type: "PHONE" };
  const d = pixKey.replace(/\D/g, "");
  if (d.length === 14) return { key: d, type: "CNPJ" };
  if (d.length === 11) return { key: d, type: "CPF" };
  return { key: pixKey, type: "PHONE" };
}

export async function sendPixDisbursement(params: {
  amountCents: number;
  pixKey: string;
  description: string;
}): Promise<string> {
  const { key, type } = inferAsaasKeyType(params.pixKey);

  const data = await asaasRequest<{ id: string }>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      value: params.amountCents / 100,
      pixAddressKey: key,
      pixAddressKeyType: type,
      description: params.description,
    }),
  });
  return String(data.id);
}

export type AsaasTransfer = {
  id: string;
  status: string;
  value: number;
  pixAddressKey: string;
  pixAddressKeyType: string;
  description: string;
  transferDate: string;
};

export async function getTransferStatus(transferId: string): Promise<AsaasTransfer> {
  return asaasRequest<AsaasTransfer>(`/transfers/${transferId}`);
}
