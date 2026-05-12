import { NextResponse } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlayerSummaries } from "@/lib/steam";

export async function POST() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const players = await getPlayerSummaries([user.steamId]).catch(() => []);
  const player = players[0];
  if (!player) return err("STEAM_API_ERROR", "Não foi possível buscar o perfil na Steam", 502);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      personaName: player.personaname,
      avatarUrl: player.avatar,
      avatarMedium: player.avatarmedium,
      avatarFull: player.avatarfull,
      profileUrl: player.profileurl,
    },
  });

  return ok({ personaName: updated.personaName, avatarUrl: updated.avatarUrl });
}
