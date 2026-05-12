import { NextResponse } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlayerSummaries } from "@/lib/steam";

export async function POST() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  let players: Awaited<ReturnType<typeof getPlayerSummaries>> = [];
  let fetchError: unknown = null;
  try {
    players = await getPlayerSummaries([user.steamId]);
  } catch (e) {
    fetchError = e;
  }
  const player = players[0];
  if (!player) {
    console.error("refresh-steam-profile failed", {
      steamId: user.steamId,
      hasKey: !!process.env.STEAM_API_KEY,
      fetchError: String(fetchError),
      playersCount: players.length,
    });
    return err("STEAM_API_ERROR", "Não foi possível buscar o perfil na Steam", 502);
  }

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
