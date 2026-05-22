import { prisma } from "./prisma";
import { createNotification } from "./notifications/service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AchievementTrigger =
  | { type: "pledge_paid"; pledgeId: string }
  | { type: "wishlist_added"; itemId: string }
  | { type: "family_created"; familyId: string }
  | { type: "membership_active"; familyId: string; durationDays?: number }
  | { type: "pix_paid_at_night" }
  | { type: "spot_bought" };

// Cosmetics granted per achievement slug (order = avatar_frame, profile_bg, name_tag, card_effect, cover_theme)
const ACHIEVEMENT_COSMETICS: Record<string, string[]> = {
  "colecionador-de-traumas":              ["etiqueta-olhos-escuridao"],
  "dormiu-com-a-luz-acesa":              ["etiqueta-olhos-escuridao", "moldura-assombracao"],
  "nao-pode-assistir-mas-pode-comprar":  ["etiqueta-olhos-escuridao", "moldura-assombracao", "bg-mansao-sombria"],
  "senhor-das-trevas":                   ["etiqueta-olhos-escuridao", "moldura-assombracao", "bg-mansao-sombria", "efeito-maldicao-ativa", "capa-cripta-ancestral"],
  "mecenas-da-dungeon":                  ["etiqueta-moeda-giratoria"],
  "lancador-de-coin":                    ["etiqueta-moeda-giratoria"],
  "compra-tudo-nao-pode":                ["etiqueta-moeda-giratoria", "moldura-coroa-mecenas"],
  "robin-hood-dos-pixels":               ["etiqueta-moeda-giratoria", "moldura-coroa-mecenas"],
  "o-tesouro-de-ganon":                  ["etiqueta-moeda-giratoria", "moldura-coroa-mecenas", "bg-sala-tesouro"],
  "patrocinador-da-jogatina-alheia":     ["etiqueta-moeda-giratoria", "moldura-coroa-mecenas", "bg-sala-tesouro", "efeito-toque-midas", "capa-sala-tesouro"],
  "sem-amigos-mas-com-coop":             ["etiqueta-dois-controles"],
  "elo-de-guilda":                       ["etiqueta-dois-controles", "moldura-corrente-cla"],
  "a-familia-que-joga-unida":            ["etiqueta-dois-controles", "moldura-corrente-cla", "bg-fortaleza-cla"],
  "mestre-da-cooperacao":                ["etiqueta-dois-controles", "moldura-corrente-cla", "bg-fortaleza-cla", "efeito-sincronizado", "capa-fortaleza-cla"],
  "sem-casa-no-mapa":                    ["etiqueta-escudo-familia"],
  "membro-honroso-do-cla":              ["etiqueta-escudo-familia"],
  "aquele-que-nao-sai-da-guilda":       ["etiqueta-escudo-familia", "moldura-brasao-real"],
  "fundador-de-linhagem":               ["etiqueta-escudo-familia", "moldura-brasao-real", "capa-salao-trono"],
  "pix-as-2-da-manha":                  ["etiqueta-lua-carrinho", "moldura-noite-compras"],
  "sem-volta-agora":                    ["etiqueta-lua-carrinho"],
  "confiavel-como-save":                ["etiqueta-lua-carrinho", "moldura-noite-compras", "capa-cidade-neon"],
  // Overlay cosmetics
  "olhos-nas-trevas":                   ["overlay-nevoa-rasteira"],
  "chama-das-sombras":                  ["overlay-chama-violeta"],
  "brilho-do-mecenas":                  ["overlay-shimmer-dourado"],
  "cacador-de-coop":                    ["overlay-scanner"],
  "bandeira-do-cla":                    ["overlay-bandeiras"],
  "soberano-da-linhagem":               ["overlay-radiancia-real"],
  "noturno-inveterado":                 ["overlay-chuva-neon"],
  "reliquia-retro":                     ["overlay-crt"],
  "singularidade":                      ["overlay-blackhole"],
};

// ─── Condition checkers ────────────────────────────────────────────────────────

async function countFundedHorrorGames(userId: string): Promise<number> {
  const pledges = await prisma.pledge.findMany({
    where: { pledgerUserId: userId, status: "active", paidAt: { not: null } },
    include: { wishlistItem: { select: { steamAppId: true } } },
  });
  const appIds = [...new Set(pledges.map((p) => p.wishlistItem.steamAppId))];
  if (appIds.length === 0) return 0;
  const caches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: appIds } },
    select: { steamAppId: true, payload: true },
  });
  return caches.filter((c) => {
    const genres = (c.payload as { genres?: string[] }).genres ?? [];
    return genres.includes("Terror");
  }).length;
}

async function countHorrorWishlistItems(userId: string): Promise<number> {
  const items = await prisma.wishlistItem.findMany({
    where: { ownerUserId: userId, status: { not: "cancelled" } },
    select: { steamAppId: true },
  });
  const appIds = [...new Set(items.map((i) => i.steamAppId))];
  if (appIds.length === 0) return 0;
  const caches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: appIds } },
    select: { payload: true },
  });
  return caches.filter((c) => {
    const genres = (c.payload as { genres?: string[] }).genres ?? [];
    return genres.includes("Terror");
  }).length;
}

async function countCoopGamesFunded(userId: string): Promise<number> {
  const pledges = await prisma.pledge.findMany({
    where: { pledgerUserId: userId, status: "active", paidAt: { not: null } },
    include: { wishlistItem: { select: { steamAppId: true } } },
  });
  const appIds = [...new Set(pledges.map((p) => p.wishlistItem.steamAppId))];
  if (appIds.length === 0) return 0;
  const caches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: appIds } },
    select: { payload: true },
  });
  return caches.filter((c) => {
    const genres = (c.payload as { genres?: string[] }).genres ?? [];
    return genres.includes("Co-op");
  }).length;
}

async function totalPledgeCents(userId: string): Promise<number> {
  const result = await prisma.pledge.aggregate({
    where: { pledgerUserId: userId, status: "active", paidAt: { not: null } },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}

async function countCompletedPledges(userId: string): Promise<number> {
  return prisma.pledge.count({
    where: { pledgerUserId: userId, status: "active", paidAt: { not: null } },
  });
}

async function countCancelledPledges(userId: string): Promise<number> {
  return prisma.pledge.count({
    where: { pledgerUserId: userId, status: "withdrawn" },
  });
}

async function membershipDays(userId: string): Promise<number> {
  const membership = await prisma.familyMembership.findFirst({
    where: { userId, status: "active" },
    orderBy: { joinedAt: "asc" },
    select: { joinedAt: true },
  });
  if (!membership) return 0;
  return Math.floor((Date.now() - membership.joinedAt.getTime()) / (86400 * 1000));
}

async function familyAllHaveCoopGame(userId: string): Promise<boolean> {
  const membership = await prisma.familyMembership.findFirst({
    where: { userId, status: "active" },
    select: { familyId: true },
  });
  if (!membership) return false;
  const members = await prisma.familyMembership.findMany({
    where: { familyId: membership.familyId, status: "active" },
    select: { userId: true },
  });
  for (const m of members) {
    const hasCoop = await prisma.pledge.findFirst({
      where: { pledgerUserId: m.userId, status: "active", paidAt: { not: null } },
      include: { wishlistItem: { select: { steamAppId: true } } },
    });
    if (!hasCoop) return false;
    const cache = await prisma.steamAppCache.findUnique({
      where: { steamAppId: hasCoop.wishlistItem.steamAppId },
    });
    const genres = (cache?.payload as { genres?: string[] } | null)?.genres ?? [];
    if (!genres.includes("Co-op")) return false;
  }
  return true;
}

// ─── Condition map ────────────────────────────────────────────────────────────

async function checkCondition(userId: string, slug: string): Promise<boolean> {
  switch (slug) {
    case "colecionador-de-traumas":             return (await countFundedHorrorGames(userId)) >= 2;
    case "dormiu-com-a-luz-acesa":             return (await countFundedHorrorGames(userId)) >= 5;
    case "nao-pode-assistir-mas-pode-comprar": return (await countHorrorWishlistItems(userId)) >= 10;
    case "senhor-das-trevas": {
      const prev = ["colecionador-de-traumas", "dormiu-com-a-luz-acesa", "nao-pode-assistir-mas-pode-comprar"];
      const unlocked = await prisma.userAchievement.count({
        where: { userId, achievement: { slug: { in: prev } } },
      });
      return unlocked >= prev.length;
    }
    case "mecenas-da-dungeon":              return (await countCompletedPledges(userId)) >= 1;
    case "lancador-de-coin":               return (await countCompletedPledges(userId)) >= 5;
    case "compra-tudo-nao-pode":           return (await countCompletedPledges(userId)) >= 10;
    case "robin-hood-dos-pixels":          return (await totalPledgeCents(userId)) >= 10000;
    case "o-tesouro-de-ganon":             return (await totalPledgeCents(userId)) >= 50000;
    case "patrocinador-da-jogatina-alheia": {
      const prev = ["mecenas-da-dungeon","lancador-de-coin","compra-tudo-nao-pode","robin-hood-dos-pixels","o-tesouro-de-ganon"];
      const unlocked = await prisma.userAchievement.count({
        where: { userId, achievement: { slug: { in: prev } } },
      });
      return unlocked >= prev.length;
    }
    case "sem-amigos-mas-com-coop":        return (await countCoopGamesFunded(userId)) >= 1;
    case "elo-de-guilda":                  return (await countCoopGamesFunded(userId)) >= 5;
    case "a-familia-que-joga-unida":       return familyAllHaveCoopGame(userId);
    case "mestre-da-cooperacao": {
      const prev = ["sem-amigos-mas-com-coop","elo-de-guilda","a-familia-que-joga-unida"];
      const unlocked = await prisma.userAchievement.count({
        where: { userId, achievement: { slug: { in: prev } } },
      });
      return unlocked >= prev.length;
    }
    case "sem-casa-no-mapa": {
      const count = await prisma.family.count({ where: { chiefId: userId } });
      return count >= 1;
    }
    case "membro-honroso-do-cla":         return (await membershipDays(userId)) >= 30;
    case "aquele-que-nao-sai-da-guilda":  return (await membershipDays(userId)) >= 90;
    case "fundador-de-linhagem": {
      const days = await membershipDays(userId);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { reputationScore: true } });
      return days >= 90 && (user?.reputationScore ?? 0) >= 90;
    }
    case "pix-as-2-da-manha": {
      const nightPledge = await prisma.pledge.findFirst({
        where: { pledgerUserId: userId, paidAt: { not: null } },
        select: { paidAt: true },
      });
      if (!nightPledge?.paidAt) return false;
      const h = nightPledge.paidAt.getHours();
      return h >= 0 && h < 3;
    }
    case "sem-volta-agora": {
      const spot = await prisma.familyMembership.findFirst({
        where: { userId, spotExpiresAt: { not: null } },
      });
      return !!spot;
    }
    case "confiavel-como-save": {
      const completed = await countCompletedPledges(userId);
      const cancelled = await countCancelledPledges(userId);
      return completed >= 10 && cancelled === 0;
    }
    case "olhos-nas-trevas":    return (await countHorrorWishlistItems(userId)) >= 3;
    case "chama-das-sombras":   return (await countFundedHorrorGames(userId)) >= 3;
    case "brilho-do-mecenas":   return (await totalPledgeCents(userId)) >= 20000;
    case "cacador-de-coop":     return (await countCoopGamesFunded(userId)) >= 3;
    case "bandeira-do-cla": {
      const mem = await prisma.familyMembership.findFirst({
        where: { userId, status: "active" },
        select: { familyId: true },
      });
      if (!mem) return false;
      const count = await prisma.familyMembership.count({
        where: { familyId: mem.familyId, status: "active" },
      });
      return count >= 3;
    }
    case "soberano-da-linhagem": return (await membershipDays(userId)) >= 120;
    case "noturno-inveterado": {
      const pledges = await prisma.pledge.findMany({
        where: { pledgerUserId: userId, paidAt: { not: null } },
        select: { paidAt: true },
      });
      const nightCount = pledges.filter(p => {
        const h = p.paidAt!.getHours();
        return h >= 0 && h < 6;
      }).length;
      return nightCount >= 3;
    }
    case "reliquia-retro": return (await membershipDays(userId)) >= 60;
    case "singularidade": {
      const all21 = [
        "colecionador-de-traumas","dormiu-com-a-luz-acesa","nao-pode-assistir-mas-pode-comprar","senhor-das-trevas",
        "mecenas-da-dungeon","lancador-de-coin","compra-tudo-nao-pode","robin-hood-dos-pixels","o-tesouro-de-ganon","patrocinador-da-jogatina-alheia",
        "sem-amigos-mas-com-coop","elo-de-guilda","a-familia-que-joga-unida","mestre-da-cooperacao",
        "sem-casa-no-mapa","membro-honroso-do-cla","aquele-que-nao-sai-da-guilda","fundador-de-linhagem",
        "pix-as-2-da-manha","sem-volta-agora","confiavel-como-save",
      ];
      const unlocked = await prisma.userAchievement.count({
        where: { userId, achievement: { slug: { in: all21 } } },
      });
      return unlocked >= all21.length;
    }
    default: return false;
  }
}

// ─── Grant logic ──────────────────────────────────────────────────────────────

async function grantAchievement(userId: string, achievementSlug: string): Promise<boolean> {
  const achievement = await prisma.achievement.findUnique({ where: { slug: achievementSlug } });
  if (!achievement) return false;

  const alreadyHas = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (alreadyHas) return false;

  const cosmeticSlugs = ACHIEVEMENT_COSMETICS[achievementSlug] ?? [];
  const cosmetics = cosmeticSlugs.length > 0
    ? await prisma.cosmetic.findMany({ where: { slug: { in: cosmeticSlugs } } })
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.userAchievement.create({
      data: { userId, achievementId: achievement.id },
    });
    for (const cosmetic of cosmetics) {
      await tx.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
        update: {},
        create: { userId, cosmeticId: cosmetic.id, source: achievementSlug },
      });
    }
    await createNotification(tx, {
      recipientUserId: userId,
      type: "ACHIEVEMENT_UNLOCKED",
      payload: {
        achievementSlug,
        title: achievement.title,
        description: achievement.description,
        rarity: achievement.rarity,
        cosmeticsUnlocked: cosmetics.map((c) => `${c.name} (${c.type})`).join(", "),
        cosmeticsCount: cosmetics.length,
      },
    });
  });

  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const ALL_SLUGS = Object.keys(ACHIEVEMENT_COSMETICS);

export async function checkAchievements(userId: string, trigger: AchievementTrigger): Promise<void> {
  // Map triggers to which achievement slugs to check
  const toCheck: string[] = (() => {
    switch (trigger.type) {
      case "pledge_paid":
        return ["colecionador-de-traumas","dormiu-com-a-luz-acesa","nao-pode-assistir-mas-pode-comprar","senhor-das-trevas",
                "mecenas-da-dungeon","lancador-de-coin","compra-tudo-nao-pode","robin-hood-dos-pixels","o-tesouro-de-ganon","patrocinador-da-jogatina-alheia",
                "sem-amigos-mas-com-coop","elo-de-guilda","a-familia-que-joga-unida","mestre-da-cooperacao",
                "pix-as-2-da-manha","confiavel-como-save",
                "chama-das-sombras","brilho-do-mecenas","cacador-de-coop","noturno-inveterado","singularidade"];
      case "wishlist_added":
        return ["nao-pode-assistir-mas-pode-comprar","senhor-das-trevas","olhos-nas-trevas","singularidade"];
      case "family_created":
        return ["sem-casa-no-mapa","singularidade"];
      case "membership_active":
        return ["membro-honroso-do-cla","aquele-que-nao-sai-da-guilda","fundador-de-linhagem",
                "bandeira-do-cla","soberano-da-linhagem","reliquia-retro","singularidade"];
      case "pix_paid_at_night":
        return ["pix-as-2-da-manha","noturno-inveterado","singularidade"];
      case "spot_bought":
        return ["sem-volta-agora","singularidade"];
      default:
        return ALL_SLUGS;
    }
  })();

  // Get already unlocked slugs to skip
  const achievements = await prisma.achievement.findMany({
    where: { slug: { in: toCheck } },
    select: { id: true, slug: true },
  });
  const alreadyUnlocked = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: achievements.map((a) => a.id) } },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(alreadyUnlocked.map((u) => u.achievementId));
  const pending = achievements.filter((a) => !unlockedIds.has(a.id));

  for (const ach of pending) {
    try {
      const met = await checkCondition(userId, ach.slug);
      if (met) await grantAchievement(userId, ach.slug);
    } catch (e) {
      console.error(`[achievements] check failed for ${ach.slug}:`, e);
    }
  }
}
