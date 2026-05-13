"use client";

import { useMemo } from "react";
import { SteamLibraryPanel } from "@/components/family/steam-library-panel";
import { getMemberColor } from "@/lib/utils";

type Member = { id: string };

type Props = {
  familyId: string;
  members: Member[];
  wishlistAppIds: number[];
};

export function CatalogSteamPanel({ familyId, members, wishlistAppIds }: Props) {
  const memberColors = useMemo(
    () => new Map(members.map((m, i) => [m.id, getMemberColor(i)])),
    [members]
  );
  const sharedWishlistAppIds = useMemo(() => new Set(wishlistAppIds), [wishlistAppIds]);

  return (
    <SteamLibraryPanel
      familyId={familyId}
      currentUserId=""
      memberColors={memberColors}
      sharedWishlistAppIds={sharedWishlistAppIds}
    />
  );
}
