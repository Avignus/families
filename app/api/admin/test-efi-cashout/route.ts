import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import https from "node:https";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

// One-shot: test Efí outgoing PIX to validate fee structure.
// GET /api/admin/test-efi-cashout?key=31986799101&cents=1
// Header: Authorization: Bearer <RESET_TEMP_SECRET>
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const pixKey = req.nextUrl.searchParams.get("key") ?? "31986799101";
  const cents = Math.max(1, parseInt(req.nextUrl.searchParams.get("cents") ?? "1", 10));
  const valor = (cents / 100).toFixed(2);

  const b64 = process.env.EFI_CERT_B64;
  const clientId = process.env.EFI_CLIENT_ID;
  const clientSecret = process.env.EFI_CLIENT_SECRET;
  if (!b64 || !clientId || !clientSecret) {
    return NextResponse.json({ error: "EFI env vars missing" }, { status: 500 });
  }

  const cert = Buffer.from(b64, "base64");
  const baseUrl = process.env.EFI_SANDBOX === "1"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br";
  const hostname = new URL(baseUrl).hostname;

  function rawRequest(path: string, opts: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve) => {
      const req2 = https.request(
        { hostname, port: 443, path, method: opts.method ?? "GET", headers: { "Content-Type": "application/json", ...opts.headers }, pfx: cert, passphrase: process.env.EFI_CERT_PASSPHRASE ?? "" },
        (res) => {
          let data = "";
          res.on("data", (c) => { data += c; });
          res.on("end", () => {
            let body: unknown;
            try { body = JSON.parse(data); } catch { body = data; }
            resolve({ status: res.statusCode ?? 0, body });
          });
        }
      );
      req2.on("error", (e) => resolve({ status: 0, body: String(e) }));
      if (opts.body) req2.write(opts.body);
      req2.end();
    });
  }

  // 1. Get token
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await rawRequest("/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (tokenRes.status !== 200) {
    return NextResponse.json({ step: "token", ...tokenRes });
  }
  const token = (tokenRes.body as { access_token: string }).access_token;
  const bearer = { Authorization: `Bearer ${token}` };

  // PUT /v2/gn/pix/{idEnvio} exists — test different body shapes
  const idEnvio = crypto.randomUUID().replace(/-/g, "").slice(0, 35);
  const path = `/v2/gn/pix/${idEnvio}`;
  const bodyCandidates = [
    { label: "pagamento.chave",   body: { valor, pagamento:   { chave: pixKey, infoPagador: "Teste repasse" } } },
    { label: "favorecido.chave",  body: { valor, favorecido:  { chave: pixKey, nome: "Igor" } } },
    { label: "destinatario.chave",body: { valor, destinatario:{ chave: pixKey } } },
    { label: "chave flat",        body: { valor, chave: pixKey, infoEntreClientes: "Teste repasse" } },
    { label: "minimal",           body: { valor, chave: pixKey } },
  ];

  const attempts: Array<{ label: string; status: number; body: unknown }> = [];
  for (const candidate of bodyCandidates) {
    const res = await rawRequest(path, { method: "PUT", headers: bearer, body: JSON.stringify(candidate.body) });
    attempts.push({ label: candidate.label, ...res });
    if (res.status < 400) break;
    // Don't retry if it's not a body-shape error
    const errName = (res.body as { nome?: string }).nome;
    if (errName !== "json_invalido") break;
  }

  const success = attempts.find((a) => a.status < 400);
  return NextResponse.json({
    pixKey, valor, sandbox: process.env.EFI_SANDBOX === "1",
    success: !!success,
    attempts,
  });
}
