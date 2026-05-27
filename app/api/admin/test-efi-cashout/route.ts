import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import https from "node:https";

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

  // 2. Try endpoints for outgoing PIX
  const body = JSON.stringify({ valor, chave: pixKey, descricao: "Teste repasse Families.im" });
  const candidates = [
    { label: "POST /v2/gn/pix", path: "/v2/gn/pix", method: "POST" },
    { label: "POST /v2/pix",    path: "/v2/pix",    method: "POST" },
  ];

  const attempts: Array<{ label: string; status: number; body: unknown }> = [];
  for (const ep of candidates) {
    const res = await rawRequest(ep.path, { method: ep.method, headers: bearer, body });
    attempts.push({ label: ep.label, ...res });
    if (res.status < 400) break; // first success wins
  }

  const success = attempts.find((a) => a.status < 400);
  return NextResponse.json({
    pixKey, valor, sandbox: process.env.EFI_SANDBOX === "1",
    success: !!success,
    attempts,
  });
}
