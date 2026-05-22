import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const EQUIP_TYPES = ["avatarFrame", "profileBg", "nameTag", "cardEffect"] as const;
type EquipType = typeof EQUIP_TYPES[number];

const Schema = z.object({
  type: z.enum(EQUIP_TYPES),
  cosmeticId: z.string().nullable(),
});

const DB_FIELD: Record<EquipType, string> = {
  avatarFrame: "avatarFrameId",
  profileBg:   "profileBgId",
  nameTag:     "nameTagId",
  cardEffect:  "cardEffectId",
};

export async function PATCH(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, Schema);
  if (isApiError(body)) return body;

  // If equipping (not clearing), verify user owns this cosmetic
  if (body.cosmeticId) {
    const owned = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId: user.id, cosmeticId: body.cosmeticId } },
    });
    if (!owned) return err("NOT_OWNED", "Você não possui este cosmético", 403);

    const cosmetic = await prisma.cosmetic.findUnique({ where: { id: body.cosmeticId } });
    const expectedType = body.type === "avatarFrame" ? "avatar_frame"
      : body.type === "profileBg" ? "profile_bg"
      : body.type === "nameTag" ? "name_tag"
      : "card_effect";
    if (cosmetic?.type !== expectedType) {
      return err("WRONG_TYPE", "Tipo de cosmético incompatível", 400);
    }
  }

  await prisma.equippedCosmetics.upsert({
    where: { userId: user.id },
    update: { [DB_FIELD[body.type]]: body.cosmeticId },
    create: { userId: user.id, [DB_FIELD[body.type]]: body.cosmeticId },
  });

  return ok({ equipped: true });
}
