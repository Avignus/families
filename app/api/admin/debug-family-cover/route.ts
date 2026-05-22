import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const steamId = req.nextUrl.searchParams.get("steamId") ?? "76561198045962425";

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true, personaName: true },
  });

  if (!user) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

  const families = await prisma.family.findMany({
    where: { chiefId: user.id },
    select: {
      id: true,
      name: true,
      activeCoverThemeId: true,
      activeCoverOverlayId: true,
      activeCoverTheme: { select: { slug: true, config: true } },
      activeCoverOverlay: { select: { slug: true, config: true } },
      memberPersonalizations: {
        where: { userId: user.id },
        select: {
          coverThemeId: true,
          coverOverlayId: true,
          coverTheme: { select: { slug: true } },
          coverOverlay: { select: { slug: true } },
        },
      },
    },
  });

  const overlaysInDB = await prisma.cosmetic.findMany({
    where: { type: "cover_overlay" },
    select: { id: true, slug: true, config: true },
  });

  const ownedOverlays = await prisma.userCosmetic.findMany({
    where: { userId: user.id, cosmetic: { type: "cover_overlay" } },
    select: { cosmeticId: true, cosmetic: { select: { slug: true } } },
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, personaName: user.personaName },
    families,
    overlaysInDB,
    ownedOverlays,
  });
}
