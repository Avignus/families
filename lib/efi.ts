import crypto from "node:crypto";
import https from "node:https";

// Same platform-level fee rates as Asaas — not provider-specific
export const SERVICE_FEE_RATE = parseFloat(process.env.SERVICE_FEE_RATE ?? "0.18");
export const ENTRY_FEE_SERVICE_RATE = parseFloat(process.env.ENTRY_FEE_SERVICE_RATE ?? "0.18");
export const EFI_MIN_CHARGE_CENTS = 1; // 1 centavo — Efí não tem mínimo prático; limite de negócio definido no front

export type PixPaymentResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  status: string;
  expiresAt: Date;
};

function getBaseUrl(): string {
  return process.env.EFI_SANDBOX === "1"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br";
}

function getCert(): Buffer {
  const b64 = process.env.EFI_CERT_B64;
  if (!b64) throw new Error("EFI_CERT_B64 não configurada (base64 do arquivo .p12 baixado no painel Efí)");
  return Buffer.from(b64, "base64");
}

// Per-instance OAuth2 token cache; safe for serverless (short-lived)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const clientId = process.env.EFI_CLIENT_ID;
  const clientSecret = process.env.EFI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("EFI_CLIENT_ID ou EFI_CLIENT_SECRET não configurados");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await efiRawRequest<{ access_token: string; expires_in: number }>("/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    skipToken: true,
  });

  cachedToken = { token: res.access_token, expiresAt: Date.now() + (res.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function efiRawRequest<T>(
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    skipToken?: boolean;
  } = {}
): Promise<T> {
  const cert = getCert();
  const hostname = new URL(getBaseUrl()).hostname;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };

  if (!opts.skipToken) {
    const token = await getToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: opts.method ?? "GET",
        headers,
        pfx: cert,
        passphrase: process.env.EFI_CERT_PASSPHRASE ?? "",
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Efí API ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(data ? (JSON.parse(data) as T) : ({} as T));
          } catch {
            reject(new Error(`Efí parse error: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function makeTxId(): string {
  return crypto.randomBytes(16).toString("hex"); // 32 hex chars — valid Efí txid
}

export function normalizeEfiStatus(status: string): string {
  switch (status) {
    case "CONCLUIDA": return "approved";
    case "ATIVA": return "pending";
    case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
    case "REMOVIDA_PELO_PSP": return "cancelled";
    default: return status.toLowerCase();
  }
}

export async function createPixPayment(params: {
  amountCents: number;
  description: string;
  payerSteamId: string;
  payerName: string;
  externalReference: string;
  notificationUrl: string; // unused — Efí webhook registered once via registerEfiWebhook()
}): Promise<PixPaymentResult> {
  if (process.env.NODE_ENV !== "production" && process.env.MOCK_PIX === "1") {
    return {
      paymentId: `mock-efi-${Date.now()}`,
      qrCode: "00020126580014BR.GOV.BCB.PIX0136mock-pix-qr-code-for-dev-testing52040000530398654071.005802BR5925Dev Mock PIX Payment6009SAO PAULO62070503***63041D3D",
      qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ticketUrl: "",
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  const pixKey = process.env.EFI_PIX_KEY;
  if (!pixKey) throw new Error("EFI_PIX_KEY não configurada");

  const txid = makeTxId();
  const charge = await efiRawRequest<{ loc: { id: number }; status: string }>(`/v2/cob/${txid}`, {
    method: "PUT",
    body: JSON.stringify({
      calendario: { expiracao: 86400 },
      valor: { original: (params.amountCents / 100).toFixed(2) },
      chave: pixKey,
      solicitacaoPagador: params.description,
      infoAdicionais: [{ nome: "ref", valor: params.externalReference }],
    }),
  });

  const qr = await efiRawRequest<{ qrcode: string; imagemQrcode: string }>(
    `/v2/loc/${charge.loc.id}/qrcode`
  );

  return {
    paymentId: txid,
    qrCode: qr.qrcode ?? "",
    // Efí returns imagemQrcode with "data:image/png;base64," prefix already included;
    // strip it so callers get raw base64 (consistent with Asaas).
    qrCodeBase64: (qr.imagemQrcode ?? "").replace(/^data:image\/[^;]+;base64,/, ""),
    ticketUrl: "",
    status: normalizeEfiStatus(charge.status),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

export async function getChargeByTxId(txid: string): Promise<{
  status: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
  pix?: Array<{ endToEndId: string; valor: string }>;
}> {
  return efiRawRequest(`/v2/cob/${txid}`);
}

export async function getPaymentStatus(txid: string): Promise<string | null> {
  try {
    const charge = await getChargeByTxId(txid);
    return normalizeEfiStatus(charge.status);
  } catch {
    return null;
  }
}

export async function getPaymentsByExternalReference(
  _externalRef: string
): Promise<Array<{ id: string; status: string; value: number }>> {
  // Efí doesn't support querying by infoAdicionais; all status updates come via webhook
  return [];
}

export async function refundPayment(txid: string, amountCents: number): Promise<void> {
  const charge = await getChargeByTxId(txid);
  const e2eId = charge.pix?.[0]?.endToEndId;
  if (!e2eId) throw new Error(`Nenhum PIX confirmado para a cobrança ${txid}`);

  const devolucaoId = makeTxId();
  await efiRawRequest(`/v2/pix/${e2eId}/devolucao/${devolucaoId}`, {
    method: "PUT",
    body: JSON.stringify({ valor: (amountCents / 100).toFixed(2) }),
  });
}

export async function sendPixDisbursement(params: {
  amountCents: number;
  pixKey: string;
  description: string;
}): Promise<string> {
  // Requires pix.write scope with outgoing PIX (pix.send) enabled in Efí dashboard
  const txid = makeTxId();
  await efiRawRequest(`/v2/pix`, {
    method: "POST",
    body: JSON.stringify({
      valor: (params.amountCents / 100).toFixed(2),
      chave: params.pixKey,
      descricao: params.description,
    }),
  });
  return txid;
}

export type EfiTransfer = {
  id: string;
  status: string;
  value: number;
  pixKey: string;
  description: string;
  transferDate: string;
};

export async function getTransferStatus(txid: string): Promise<EfiTransfer> {
  const res = await efiRawRequest<{
    status?: string;
    valor?: string;
    chave?: string;
    descricao?: string;
    horario?: string;
  }>(`/v2/pix/${txid}`);
  return {
    id: txid,
    status: res.status ?? "unknown",
    value: parseFloat(res.valor ?? "0"),
    pixKey: res.chave ?? "",
    description: res.descricao ?? "",
    transferDate: res.horario ?? new Date().toISOString(),
  };
}

// One-time setup: registers the webhook URL with Efí for the configured PIX key
// Run via: npx ts-node scripts/register-efi-webhook.ts
export async function registerEfiWebhook(webhookUrl: string): Promise<void> {
  const pixKey = process.env.EFI_PIX_KEY;
  if (!pixKey) throw new Error("EFI_PIX_KEY não configurada");
  await efiRawRequest(`/v2/webhook/${encodeURIComponent(pixKey)}`, {
    method: "PUT",
    body: JSON.stringify({ webhookUrl }),
  });
}
