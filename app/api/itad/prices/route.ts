import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api";
import { itadAllDeals } from "@/lib/itad";
import { getAppDetails } from "@/lib/steam";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const steamAppId = Number(req.nextUrl.searchParams.get("steamAppId"));
  if (!steamAppId || isNaN(steamAppId)) {
    return err("BAD_REQUEST", "steamAppId required", 400);
  }

  const [deals, steamData] = await Promise.all([
    itadAllDeals(steamAppId),
    getAppDetails(steamAppId),
  ]);

  return ok({
    game: steamData
      ? {
          name: steamData.name,
          headerImage: steamData.headerImage,
          priceCents: steamData.priceCents,
          originalPriceCents: steamData.originalPriceCents,
          discountPercent: steamData.discountPercent,
          isFree: steamData.isFree,
          currency: steamData.currency ?? "BRL",
        }
      : null,
    deals,
  });
}
