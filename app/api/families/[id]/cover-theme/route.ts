import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  cosmeticId: z.string().nullable().optional(),
  overlayId:  z.string().nullable().optional(),
});

// GET — list themes available to this family (unlocked by any active member)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not a member", 403);
  }

  // Default themes always available
  const defaults = await prisma.cosmetic.findMany({
    where: { type: "cover_theme", isDefault: true },
  });

  // Themes unlocked by any active member of this family
  const poolThemes = await prisma.cosmetic.findMany({
    where: {
      type: "cover_theme",
      isDefault: false,
      userCosmetics: {
        some: {
          user: {
            memberships: { some: { familyId: params.id, status: "active" } },
          },
        },
      },
    },
    include: {
      userCosmetics: {
        where: {
          user: {
            memberships: { some: { familyId: params.id, status: "active" } },
          },
        },
        include: { user: { select: { id: true, personaName: true, avatarUrl: true } } },
        take: 1,
      },
    },
  });

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { activeCoverThemeId: true, activeCoverOverlayId: true },
  });

  // Overlays available to this family (owned by any active member)
  const overlays = await prisma.cosmetic.findMany({
    where: {
      type: "cover_overlay",
      userCosmetics: {
        some: {
          user: { memberships: { some: { familyId: params.id, status: "active" } } },
        },
      },
    },
  });

  return ok({
    available: [
      ...defaults.map((c) => ({ ...c, contributor: null })),
      ...poolThemes.map((c) => ({
        ...c,
        contributor: c.userCosmetics[0]?.user ?? null,
        userCosmetics: undefined,
      })),
    ],
    overlays,
    activeCoverThemeId: family?.activeCoverThemeId ?? null,
    activeCoverOverlayId: family?.activeCoverOverlayId ?? null,
  });
}

// PATCH — chief sets the active cover theme
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { chiefId: true },
  });
  if (!family) return err("NOT_FOUND", "Família não encontrada", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Apenas o chief pode alterar o tema", 403);

  const body = await parseBody(req, Schema);
  if (isApiError(body)) return body;

  if (body.cosmeticId) {
    const cosmetic = await prisma.cosmetic.findUnique({ where: { id: body.cosmeticId } });
    if (!cosmetic || cosmetic.type !== "cover_theme") {
      return err("INVALID_THEME", "Tema inválido", 400);
    }

    if (!cosmetic.isDefault) {
      // Verify at least one active member unlocked this theme
      const contributed = await prisma.userCosmetic.findFirst({
        where: {
          cosmeticId: body.cosmeticId,
          user: {
            memberships: { some: { familyId: params.id, status: "active" } },
          },
        },
      });
      if (!contributed) {
        return err("THEME_NOT_IN_POOL", "Nenhum membro ativo conquistou este tema", 403);
      }
    }
  }

  // Validate overlay if provided
  if (body.overlayId) {
    const overlay = await prisma.cosmetic.findUnique({ where: { id: body.overlayId } });
    if (!overlay || overlay.type !== "cover_overlay") {
      return err("INVALID_OVERLAY", "Overlay inválido", 400);
    }
    const hasOverlay = await prisma.userCosmetic.findFirst({
      where: {
        cosmeticId: body.overlayId,
        user: { memberships: { some: { familyId: params.id, status: "active" } } },
      },
    });
    if (!hasOverlay) return err("OVERLAY_NOT_IN_POOL", "Nenhum membro possui este overlay", 403);
  }

  const data: Record<string, string | null> = {};
  if (body.cosmeticId !== undefined) data.activeCoverThemeId = body.cosmeticId ?? null;
  if (body.overlayId !== undefined)  data.activeCoverOverlayId = body.overlayId ?? null;

  await prisma.family.update({ where: { id: params.id }, data });

  return ok({ updated: true });
}
