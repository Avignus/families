import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`,
      { redirect: "follow", signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return new NextResponse(null, { status: 404 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
