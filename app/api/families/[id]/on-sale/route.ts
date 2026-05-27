import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { itadGetDealsForApp, ItadDeal } from "@/lib/itad";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type SaleItem = {
  steamAppId: number;
  name: string;
  steamPriceCents: number;
  currency: string;
  cheapestDeal: Pick<ItadDeal, "shopName" | "priceCents" | "cut" | "url">;
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active")
    return err("FORBIDDEN", "Not an active member", 403);

  // ── Wishlist items on sale ──────────────────────────────────────────────
  const wishlistItems = await prisma.wishlistItem.findMany({
    where: { familyId: params.id, status: { in: ["open", "funded"] } },
    select: { steamAppId: true, targetPriceCents: true, currency: true },
  });

  const wishlistOnSale: SaleItem[] = [];
  for (const item of wishlistItems) {
    const steamData = await getAppDetails(item.steamAppId);
    if (!steamData || steamData.isFree) continue;
    const steamPrice = steamData.priceCents || item.targetPriceCents;
    if (!steamPrice) continue;
    const deals = await itadGetDealsForApp(item.steamAppId);
    if (!deals.length) continue;
    wishlistOnSale.push({
      steamAppId: item.steamAppId,
      name: steamData.name,
      steamPriceCents: steamPrice,
      currency: item.currency,
      cheapestDeal: deals[0],
    });
  }

  // ── Recommended games on sale (excluding wishlist) ──────────────────────
  const wishlistAppIds = new Set(wishlistItems.map((i) => i.steamAppId));

  const recs = await prisma.gameRecommendation.findMany({
    where: { OR: [{ familyId: params.id }, { userId: user.id }] },
    orderBy: { generatedAt: "desc" },
    select: { steamAppId: true },
    distinct: ["steamAppId"],
    take: 40,
  });

  const recsOnSale: SaleItem[] = [];
  for (const { steamAppId } of recs) {
    if (wishlistAppIds.has(steamAppId)) continue;
    const steamData = await getAppDetails(steamAppId);
    if (!steamData || steamData.isFree || !steamData.priceCents) continue;
    const deals = await itadGetDealsForApp(steamAppId);
    if (!deals.length) continue;
    recsOnSale.push({
      steamAppId,
      name: steamData.name,
      steamPriceCents: steamData.priceCents,
      currency: steamData.currency,
      cheapestDeal: deals[0],
    });
  }

  return ok({ wishlistOnSale, recsOnSale });
}
