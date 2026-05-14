import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.ASAAS_API_KEY ?? "";
  return NextResponse.json({
    set: !!key,
    length: key.length,
    prefix: key.slice(0, 12) || "(empty)",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
