import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  coverThemeId:   z.string().nullable().optional(),
  coverOverlayId: z.string().nullable().optional(),
  coverVideoId:   z.string().nullable().optional(),
});

// GET — member's personal theme for this family
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const personalization = await prisma.familyMemberPersonalization.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    include: { coverTheme: true, coverVideo: true },
  });

  const ownedCoverThemes = await prisma.userCosmetic.findMany({
    where: { userId: user.id, cosmetic: { type: "cover_theme" } },
    include: { cosmetic: true },
  });

  const ownedCoverVideos = await prisma.userCosmetic.findMany({
    where: { userId: user.id, cosmetic: { type: "cover_video" } },
    include: { cosmetic: true },
  });

  return ok({
    coverTheme: personalization?.coverTheme ?? null,
    coverVideo: personalization?.coverVideo ?? null,
    ownedCoverThemes: ownedCoverThemes.map((uc) => uc.cosmetic),
    ownedCoverVideos: ownedCoverVideos.map((uc) => uc.cosmetic),
  });
}

// PATCH — member sets personal theme/video override
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Você não é membro ativo desta família", 403);
  }

  const body = await parseBody(req, Schema);
  if (isApiError(body)) return body;

  if (body.coverThemeId) {
    const cosmetic = await prisma.cosmetic.findUnique({ where: { id: body.coverThemeId } });
    if (!cosmetic || cosmetic.type !== "cover_theme") {
      return err("INVALID_THEME", "Tema inválido", 400);
    }
    if (!cosmetic.isDefault) {
      const owned = await prisma.userCosmetic.findUnique({
        where: { userId_cosmeticId: { userId: user.id, cosmeticId: body.coverThemeId } },
      });
      if (!owned) return err("NOT_OWNED", "Você não possui este tema", 403);
    }
  }

  if (body.coverVideoId) {
    const owned = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId: user.id, cosmeticId: body.coverVideoId } },
    });
    if (!owned) return err("NOT_OWNED", "Você não possui este vídeo", 403);
  }

  await prisma.familyMemberPersonalization.upsert({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    update: {
      ...(body.coverThemeId   !== undefined && { coverThemeId:   body.coverThemeId }),
      ...(body.coverOverlayId !== undefined && { coverOverlayId: body.coverOverlayId }),
      ...(body.coverVideoId   !== undefined && { coverVideoId:   body.coverVideoId }),
    },
    create: {
      userId: user.id,
      familyId: params.id,
      coverThemeId:   body.coverThemeId   ?? null,
      coverOverlayId: body.coverOverlayId ?? null,
      coverVideoId:   body.coverVideoId   ?? null,
    },
  });

  return ok({ updated: true });
}
