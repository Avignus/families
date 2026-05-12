// Refreshes personaName for all users whose name starts with "Steam user"
// Usage: DATABASE_URL="..." STEAM_API_KEY="..." node scripts/refresh-steam-names.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STEAM_API_KEY = process.env.STEAM_API_KEY;

if (!STEAM_API_KEY) {
  console.error("Missing STEAM_API_KEY");
  process.exit(1);
}

async function fetchPlayers(steamIds) {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamIds.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API ${res.status}`);
  const data = await res.json();
  return data.response?.players ?? [];
}

const staleUsers = await prisma.user.findMany({
  where: { personaName: { startsWith: "Steam user" } },
  select: { id: true, steamId: true, personaName: true },
});

if (staleUsers.length === 0) {
  console.log("Nenhum usuário com nome 'Steam user' encontrado.");
  process.exit(0);
}

console.log(`Atualizando ${staleUsers.length} usuário(s)...`);

// Batch in groups of 100 (Steam API limit)
for (let i = 0; i < staleUsers.length; i += 100) {
  const batch = staleUsers.slice(i, i + 100);
  const players = await fetchPlayers(batch.map(u => u.steamId));

  for (const player of players) {
    const user = batch.find(u => u.steamId === player.steamid);
    if (!user) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        personaName: player.personaname,
        avatarUrl: player.avatar,
        avatarMedium: player.avatarmedium,
        avatarFull: player.avatarfull,
        profileUrl: player.profileurl,
      },
    });
    console.log(`  ✓ ${user.steamId}: "${user.personaName}" → "${player.personaname}"`);
  }
}

console.log("Concluído.");
await prisma.$disconnect();
