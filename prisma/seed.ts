import { PrismaClient, MembershipStatus, WishlistStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Popular Steam games (appId, name, priceCents)
const GAMES = [
  { appId: 1145360, name: "Hades", priceCents: 3499 },
  { appId: 367520,  name: "Hollow Knight", priceCents: 2699 },
  { appId: 1086940, name: "Baldur's Gate 3", priceCents: 24999 },
  { appId: 1172470, name: "Apex Legends", priceCents: 0, isFree: true },
  { appId: 292030,  name: "The Witcher 3: Wild Hunt", priceCents: 4999 },
  { appId: 1245620, name: "Elden Ring", priceCents: 19999 },
  { appId: 1091500, name: "Cyberpunk 2077", priceCents: 14999 },
  { appId: 730,     name: "Counter-Strike 2", priceCents: 0, isFree: true },
  { appId: 570,     name: "Dota 2", priceCents: 0, isFree: true },
  { appId: 1517290, name: "Battlefield 2042", priceCents: 9999 },
  { appId: 1174180, name: "Red Dead Redemption 2", priceCents: 14999 },
  { appId: 271590,  name: "Grand Theft Auto V", priceCents: 7999 },
  { appId: 1203220, name: "NARAKA: BLADEPOINT", priceCents: 9999 },
  { appId: 1174370, name: "Star Wars Jedi: Fallen Order", priceCents: 9999 },
  { appId: 1551360, name: "Forza Horizon 5", priceCents: 24999 },
  { appId: 1240440, name: "Halo Infinite", priceCents: 0, isFree: true },
  { appId: 413150,  name: "Stardew Valley", priceCents: 2499 },
  { appId: 646570,  name: "Slay the Spire", priceCents: 2799 },
  { appId: 1091500, name: "Cyberpunk 2077", priceCents: 14999 },
  { appId: 1672350, name: "The Last of Us Part I", priceCents: 19999 },
  { appId: 1551360, name: "Forza Horizon 5", priceCents: 24999 },
  { appId: 752590,  name: "A Plague Tale: Requiem", priceCents: 19999 },
  { appId: 1811700, name: "The Callisto Protocol", priceCents: 14999 },
  { appId: 2050650, name: "Resident Evil 4", priceCents: 19999 },
  { appId: 976310,  name: "Ghostwire: Tokyo", priceCents: 9999 },
  { appId: 990080,  name: "Hogwarts Legacy", priceCents: 24999 },
  { appId: 1850570, name: "God of War", priceCents: 19999 },
  { appId: 2139460, name: "Marvel's Spider-Man Remastered", priceCents: 19999 },
  { appId: 1145360, name: "Hades II", priceCents: 2999 },
  { appId: 105600,  name: "Terraria", priceCents: 1999 },
];

// Cosmetic IDs (stable — seeded by migrations)
const COSMETICS = {
  theme: {
    mosaic:    "b1736828-de69-4bc9-bbb6-3e4757ec1cb4",
    gradient:  "83c6c90f-c385-4660-9e0e-f30ed26775dd",
    cripta:    "efc58400-ddca-466d-9864-a5aab9145a4b",
    tesouro:   "f6578867-0f32-48c0-919d-599afb8ff0f4",
    fortaleza: "b38b4e87-610c-46ce-a084-c47576c0d086",
    neon:      "74724312-179a-415b-808f-2a5a21abec3c",
    trono:     "dc88629c-acb7-4929-9700-882b9dfa18fc",
  },
  overlay: {
    shimmer:   "137ba478-e579-400e-9648-e1fb52d68dce",
    rain:      "90b928e6-83f2-42f5-a6b6-8f5ee16146a2",
    flags:     "406eb30d-924a-4cdd-b9f3-ce08989fd3ed",
    mist:      "0cca94f5-6ebb-48bf-9130-69aad4a76db9",
    blackhole: "d02b3230-5bea-4761-83cb-bb5f10458cdf",
    radiance:  "d0e0059e-fe05-45a4-a3b1-2c314e3827bb",
    scanner:   "a1017554-6b40-4502-952a-d1f8fc8e3942",
    crt:       "4ef2ee08-1433-4720-a494-b9d0a418e4ca",
    flame:     "f61c71bf-fd00-4071-8439-a66bede104cf",
  },
} as const;

type CosmeticKey = keyof typeof COSMETICS.theme;
type OverlayKey  = keyof typeof COSMETICS.overlay;

const FAMILY_TEMPLATES: Array<{
  name: string; description: string; entryFeeCents: number; maxMembers: number;
  theme?: CosmeticKey; overlay?: OverlayKey;
}> = [
  { name: "Turma dos Games",         description: "Grupo de amigos que joga de tudo um pouco. Bons jogos, boa companhia.",                 entryFeeCents: 3000, maxMembers: 6, theme: "mosaic",    overlay: "shimmer"   },
  { name: "Indie Lovers",            description: "Apaixonados por jogos indie. Aqui valorizamos criatividade acima de tudo.",             entryFeeCents: 2500, maxMembers: 5, theme: "gradient",  overlay: "rain"      },
  { name: "RPG Masters",             description: "Grupo focado em RPGs épicos. Baldur's Gate, Witcher, Elden Ring — é tudo nosso.",       entryFeeCents: 5000, maxMembers: 6, theme: "cripta"                         },
  { name: "FPS Squad",               description: "CS2, Apex, Battlefield — a família perfeita para quem ama ação em primeira pessoa.",    entryFeeCents: 4000, maxMembers: 6, theme: "neon",      overlay: "scanner"   },
  { name: "Caçadores de Conquistas", description: "Zeramos tudo. Se tem platinum, a gente vai atrás.",                                    entryFeeCents: 3500, maxMembers: 5, theme: "tesouro",   overlay: "radiance"  },
  { name: "Casual Gamers BR",        description: "Sem pressão, sem hype. Só jogos bons e diversão garantida.",                           entryFeeCents: 2000, maxMembers: 6, theme: "gradient",  overlay: "flags"     },
  { name: "Open World Explorers",    description: "Adoramos mundos abertos. Quanto maior o mapa, melhor.",                                 entryFeeCents: 4500, maxMembers: 6, theme: "fortaleza"                      },
  { name: "Retro & Indie",           description: "Clássicos que marcaram época e indies que vão marcar o futuro.",                        entryFeeCents: 2000, maxMembers: 5, theme: "mosaic",    overlay: "crt"       },
  { name: "Survival Crew",           description: "Valheim, Terraria, Minecraft — sobrevivemos juntos.",                                  entryFeeCents: 3000, maxMembers: 6, theme: "trono",     overlay: "blackhole" },
  { name: "Story First",             description: "Para quem coloca narrativa acima de gameplay. Jogos como arte.",                        entryFeeCents: 4000, maxMembers: 5, theme: "cripta",    overlay: "flame"     },
  { name: "Co-op Gang",              description: "Cooperativo é nosso estilo. Quanto mais junto, melhor.",                               entryFeeCents: 3500, maxMembers: 6, theme: "neon",      overlay: "mist"      },
  { name: "PS to PC",                description: "Ex-consoleiros que migraram pro PC. Recuperando o catálogo perdido.",                   entryFeeCents: 5000, maxMembers: 6, theme: "tesouro",   overlay: "shimmer"   },
  { name: "Budget Gamers",           description: "Pegamos tudo na promoção. Aqui a gente é esperto com dinheiro.",                        entryFeeCents: 1500, maxMembers: 6                                          },
  { name: "AAA Only",                description: "Só grandes lançamentos. Aqui vai dinheiro de verdade.",                                 entryFeeCents: 8000, maxMembers: 5, theme: "tesouro",   overlay: "radiance"  },
  { name: "Estrategistas",           description: "RTS, TBS, civilization — aqui a cabeça trabalha.",                                     entryFeeCents: 3500, maxMembers: 5, theme: "fortaleza", overlay: "scanner"   },
  { name: "Horror Club",             description: "Resident Evil, Silent Hill, Callisto. Coragem é requisito.",                            entryFeeCents: 4000, maxMembers: 5, theme: "cripta",    overlay: "crt"       },
  { name: "Speedrunners BR",         description: "Tempo é tudo. Qualquer jogo pode ser feito rápido.",                                    entryFeeCents: 2500, maxMembers: 6, theme: "neon",      overlay: "flags"     },
  { name: "Gamepass Refugees",       description: "Sem gamepass no BR, a gente se organiza. Aqui funciona.",                               entryFeeCents: 3000, maxMembers: 6, theme: "gradient",  overlay: "rain"      },
  { name: "Twitch Watchers",         description: "A gente assiste e depois compra. Curadoria baseada em hype.",                           entryFeeCents: 2000, maxMembers: 5, theme: "mosaic",    overlay: "blackhole" },
  { name: "Platina ou Nada",         description: "Cada jogo é uma missão completa. Nada menos que 100%.",                                entryFeeCents: 5000, maxMembers: 5, theme: "trono",     overlay: "flame"     },
];

const USERS = [
  { steamId: "76561198000000001", personaName: "Igor", avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg" },
  { steamId: "76561198000000002", personaName: "João", avatarUrl: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_full.jpg" },
  { steamId: "76561198000000003", personaName: "Maria", avatarUrl: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_full.jpg" },
  { steamId: "76561198000000004", personaName: "Pedro", avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg" },
  { steamId: "76561198000000005", personaName: "Ana", avatarUrl: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_full.jpg" },
  { steamId: "76561198000000006", personaName: "Lucas", avatarUrl: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_full.jpg" },
  { steamId: "76561198000000007", personaName: "Carla", avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg" },
  { steamId: "76561198000000008", personaName: "Rafael", avatarUrl: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_full.jpg" },
  { steamId: "76561198000000009", personaName: "Beatriz", avatarUrl: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_full.jpg" },
  { steamId: "76561198000000010", personaName: "Thiago", avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg" },
];

async function main() {
  console.log("Seeding database...");

  // Upsert all users
  const users = await Promise.all(
    USERS.map((u) =>
      prisma.user.upsert({
        where: { steamId: u.steamId },
        update: {},
        create: {
          steamId: u.steamId,
          personaName: u.personaName,
          avatarUrl: u.avatarUrl,
          avatarMedium: u.avatarUrl.replace("_full.jpg", "_medium.jpg"),
          avatarFull: u.avatarUrl,
          profileUrl: `https://steamcommunity.com/id/${u.personaName.toLowerCase()}`,
        },
      })
    )
  );

  // Seed Steam app catalog + cache
  const uniqueGames = GAMES.filter((g, i, arr) => arr.findIndex((x) => x.appId === g.appId) === i);
  for (const game of uniqueGames) {
    await prisma.steamAppCatalog.upsert({
      where: { appId: game.appId },
      update: {},
      create: { appId: game.appId, name: game.name },
    });
    await prisma.steamAppCache.upsert({
      where: { steamAppId: game.appId },
      update: {},
      create: {
        steamAppId: game.appId,
        payload: {
          appId: game.appId,
          name: game.name,
          headerImage: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`,
          capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/capsule_616x353.jpg`,
          priceCents: game.priceCents,
          currency: "BRL",
          shortDescription: `${game.name} — um dos melhores jogos disponíveis no Steam.`,
          isFree: game.isFree ?? false,
        },
      },
    });
  }

  // Create families
  for (let i = 0; i < FAMILY_TEMPLATES.length; i++) {
    const tmpl = FAMILY_TEMPLATES[i];
    const chiefIndex = i % users.length;
    const chief = users[chiefIndex];
    const familyId = `family-seed-${i + 1}`;

    await prisma.family.upsert({
      where: { id: familyId },
      update: {
        activeCoverThemeId:   tmpl.theme   ? COSMETICS.theme[tmpl.theme]     : null,
        activeCoverOverlayId: tmpl.overlay ? COSMETICS.overlay[tmpl.overlay] : null,
      },
      create: {
        id: familyId,
        name: tmpl.name,
        description: tmpl.description,
        currency: "BRL",
        isPublic: true,
        entryFeeCents: tmpl.entryFeeCents,
        maxMembers: tmpl.maxMembers,
        chiefId: chief.id,
        activeCoverThemeId:   tmpl.theme   ? COSMETICS.theme[tmpl.theme]     : null,
        activeCoverOverlayId: tmpl.overlay ? COSMETICS.overlay[tmpl.overlay] : null,
      },
    });

    // Add 3-5 members (chief + 2-4 others)
    const otherUsers = users.filter((_, j) => j !== chiefIndex);
    const memberCount = 2 + (i % 3); // 2, 3, or 4 extra members
    const members = [chief, ...otherUsers.slice((i * 2) % otherUsers.length).concat(otherUsers).slice(0, memberCount)];

    for (const member of members) {
      await prisma.familyMembership.upsert({
        where: { userId_familyId: { userId: member.id, familyId } },
        update: {},
        create: { userId: member.id, familyId, status: MembershipStatus.active },
      });
    }

    // Add 2-4 wishlist items per family (rotate through games)
    const wishlistCount = 2 + (i % 3);
    const gameSlice = uniqueGames.filter((g) => !g.isFree);
    for (let w = 0; w < wishlistCount; w++) {
      const game = gameSlice[(i + w * 3) % gameSlice.length];
      const owner = members[w % members.length];
      await prisma.wishlistItem.upsert({
        where: { familyId_steamAppId: { familyId, steamAppId: game.appId } },
        update: {},
        create: {
          familyId,
          ownerUserId: owner.id,
          steamAppId: game.appId,
          targetPriceCents: game.priceCents,
          currency: "BRL",
          status: WishlistStatus.open,
        },
      });
    }
  }

  console.log(`Seeded ${FAMILY_TEMPLATES.length} families, ${USERS.length} users, ${uniqueGames.length} games.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
