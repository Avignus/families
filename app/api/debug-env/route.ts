import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.ASAAS_API_KEY ?? "";
  const b64 = process.env.ASAAS_API_KEY_B64 ?? "";
  const decoded = b64 ? Buffer.from(b64, "base64").toString("utf-8") : "";
  return NextResponse.json({
    raw_set: !!raw, raw_length: raw.length,
    b64_set: !!b64, b64_length: b64.length,
    decoded_length: decoded.length,
    decoded_prefix: decoded.slice(0, 12) || "(empty)",
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
