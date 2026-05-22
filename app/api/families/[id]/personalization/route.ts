import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ coverThemeId: z.string().nullable() });

// GET — member's personal theme for this family
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const personalization = await prisma.familyMemberPersonalization.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    include: { coverTheme: true },
  });

  // Also return member's owned cover themes
  const ownedCoverThemes = await prisma.userCosmetic.findMany({
    where: { userId: user.id, cosmetic: { type: "cover_theme" } },
    include: { cosmetic: true },
  });

  return ok({
    coverTheme: personalization?.coverTheme ?? null,
    ownedCoverThemes: ownedCoverThemes.map((uc) => uc.cosmetic),
  });
}

// PATCH — member sets personal theme override
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
    // Member must own this theme (unless it's a default theme)
    if (!cosmetic.isDefault) {
      const owned = await prisma.userCosmetic.findUnique({
        where: { userId_cosmeticId: { userId: user.id, cosmeticId: body.coverThemeId } },
      });
      if (!owned) return err("NOT_OWNED", "Você não possui este tema", 403);
    }
  }

  await prisma.familyMemberPersonalization.upsert({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    update: { coverThemeId: body.coverThemeId },
    create: { userId: user.id, familyId: params.id, coverThemeId: body.coverThemeId },
  });

  return ok({ updated: true });
}
