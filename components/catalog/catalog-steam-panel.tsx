"use client";

import { useMemo } from "react";
import { SteamLibraryPanel } from "@/components/family/steam-library-panel";
import { getMemberColor } from "@/lib/utils";

type WishlistItem = {
  id: string;
  steamAppId: number;
  status: string;
  targetPriceCents: number;
  currency: string;
  pledges: { amountCents: number }[];
};

type Member = { id: string };

type Props = {
  familyId: string;
  members: Member[];
  wishlistItems: WishlistItem[];
};

export function CatalogSteamPanel({ familyId, members, wishlistItems }: Props) {
  const memberColors = useMemo(
    () => new Map(members.map((m, i) => [m.id, getMemberColor(i)])),
    [members]
  );
  const sharedWishlistItems = useMemo(
    () =>
      wishlistItems.map((i) => ({
        id: i.id,
        steamAppId: i.steamAppId,
        status: i.status,
        targetPriceCents: i.targetPriceCents,
        totalPledgedCents: i.pledges.reduce((sum, p) => sum + p.amountCents, 0),
        currency: i.currency,
      })),
    [wishlistItems]
  );

  return (
    <SteamLibraryPanel
      familyId={familyId}
      currentUserId=""
      memberColors={memberColors}
      sharedWishlistItems={sharedWishlistItems}
      onRefresh={() => {}}
    />
  );
}
