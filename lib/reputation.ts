import { prisma } from "@/lib/prisma";

export type ReputationTier = "bronze" | "prata" | "ouro" | "elite" | "lendario";

// Minimum XP required to reach each tier
export const TIER_XP: Record<ReputationTier, number> = {
  bronze:   0,
  prata:    600,
  ouro:     2500,
  elite:    8000,
  lendario: 25000,
};

export const TIER_ORDER: ReputationTier[] = ["bronze", "prata", "ouro", "elite", "lendario"];

export function getTier(xp: number): ReputationTier {
  if (xp >= 25000) return "lendario";
  if (xp >= 8000)  return "elite";
  if (xp >= 2500)  return "ouro";
  if (xp >= 600)   return "prata";
  return "bronze";
}

export function getXpProgress(xp: number): {
  tier: ReputationTier;
  xpInTier: number;
  tierSize: number;
  pct: number;
  nextTier: ReputationTier | null;
  xpToNext: number | null;
} {
  const tier = getTier(xp);
  const idx = TIER_ORDER.indexOf(tier);
  const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
  const tierMin = TIER_XP[tier];
  const tierMax = nextTier ? TIER_XP[nextTier] : null;
  const xpInTier = xp - tierMin;
  const tierSize = tierMax ? tierMax - tierMin : Math.max(xpInTier, 1);
  const pct = tierMax ? Math.min(100, Math.round((xpInTier / (tierMax - tierMin)) * 100)) : 100;
  const xpToNext = tierMax ? tierMax - xp : null;

  return { tier, xpInTier, tierSize, pct, nextTier, xpToNext };
}

// On-demand refreshes per rolling 7-day window
export const TIER_WEEKLY_ONDEMAND_LIMIT: Record<ReputationTier, number> = {
  bronze:   1,
  prata:    3,
  ouro:     5,
  elite:    10,
  lendario: 20,
};

// Games generated per user by the weekly cron
export const TIER_CRON_REC_COUNT: Record<ReputationTier, number> = {
  bronze:   5,
  prata:    6,
  ouro:     8,
  elite:    10,
  lendario: 12,
};

export const TIER_LABELS: Record<ReputationTier, string> = {
  bronze:   "Bronze",
  prata:    "Prata",
  ouro:     "Ouro",
  elite:    "Elite",
  lendario: "Lendário",
};

export const TIER_COLORS: Record<ReputationTier, string> = {
  bronze:   "hsl(25 60% 55%)",
  prata:    "hsl(220 15% 65%)",
  ouro:     "hsl(45 90% 55%)",
  elite:    "hsl(258 82% 66%)",
  lendario: "hsl(345 85% 58%)",
};

export const TIER_DESCRIPTIONS: Record<ReputationTier, string> = {
  bronze:   "Você está começando sua jornada. Faça pledges em itens da wishlist e pague rapidamente para acumular XP e subir de elo.",
  prata:    "Você já contribuiu em pledges e ajudou a financiar jogos para membros da família. Sua confiança está crescendo na comunidade.",
  ouro:     "Você é um colaborador ativo e consistente. Suas contribuições ajudaram a realizar compras para vários membros, demonstrando comprometimento real.",
  elite:    "Você é referência de engajamento na plataforma. Seu histórico de pledges rápidos, contribuições pioneiras e jogos financiados o coloca entre os melhores.",
  lendario: "Você alcançou o elo máximo. Sua contribuição extraordinária financiou dezenas de jogos e moldou a experiência da comunidade de uma forma que poucos conseguem.",
};

// XP sources:
//   - Base:     R$1 paid = 1 XP
//   - Prestige: game price multiplier (cheap → expensive = 1.0× → 2.2×)
//   - Speed:    paid within 2h = +8 XP, 24h = +4, 72h = +1
//   - Pioneer:  first pledge on an item = +5 XP
//   - Funding:  each game successfully funded = +20 XP (once per game)
export async function computeAndSaveReputation(userId: string): Promise<number> {
  const pledges = await prisma.pledge.findMany({
    where: { pledgerUserId: userId, status: "active" },
    include: {
      wishlistItem: {
        select: {
          status: true,
          targetPriceCents: true,
          pledges: {
            where: { status: "active" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { pledgerUserId: true },
          },
        },
      },
    },
  });

  if (pledges.length === 0) {
    await prisma.user.update({ where: { id: userId }, data: { reputationScore: 0 } });
    return 0;
  }

  let xp = 0;
  const fundedItemsSeen = new Set<string>();

  for (const pledge of pledges) {
    if (!pledge.paidAt) continue;

    const priceCents = pledge.wishlistItem.targetPriceCents;

    const baseXp = Math.floor(pledge.amountCents / 100);

    let prestige = 1.0;
    if (priceCents >= 20000)     prestige = 2.2;
    else if (priceCents >= 10000) prestige = 1.7;
    else if (priceCents >= 5000)  prestige = 1.3;

    const hours = (pledge.paidAt.getTime() - pledge.createdAt.getTime()) / 3_600_000;
    const speedBonus = hours <= 2 ? 8 : hours <= 24 ? 4 : hours <= 72 ? 1 : 0;

    const isPioneer = pledge.wishlistItem.pledges[0]?.pledgerUserId === userId;
    const pioneerBonus = isPioneer ? 5 : 0;

    let fundingBonus = 0;
    if (
      ["funded", "purchased"].includes(pledge.wishlistItem.status) &&
      !fundedItemsSeen.has(pledge.wishlistItemId)
    ) {
      fundedItemsSeen.add(pledge.wishlistItemId);
      fundingBonus = 20;
    }

    xp += Math.round(baseXp * prestige) + speedBonus + pioneerBonus + fundingBonus;
  }

  await prisma.user.update({ where: { id: userId }, data: { reputationScore: xp } });
  return xp;
}
