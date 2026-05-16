import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateSpotPrice } from "@/lib/spot-price";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { spotPricingEnabled: true },
  });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (!family.spotPricingEnabled) return err("NOT_ENABLED", "Spot pricing not enabled", 400);

  const result = await calculateSpotPrice(params.id, user.id);
  return ok(result);
}
