import { prisma } from "@/lib/prisma";

export type FamilyTier = "ferro" | "bronze" | "prata" | "ouro" | "elite";

// Games generated per family by the weekly cron
export const FAMILY_TIER_CRON_REC_COUNT: Record<FamilyTier, number> = {
  ferro:   4,
  bronze:  5,
  prata:   6,
  ouro:    8,
  elite:   10,
};

export function getFamilyTier(score: number): FamilyTier {
  if (score >= 81) return "elite";
  if (score >= 61) return "ouro";
  if (score >= 41) return "prata";
  if (score >= 21) return "bronze";
  return "ferro";
}

export const FAMILY_TIER_LABELS: Record<FamilyTier, string> = {
  ferro: "Ferro",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  elite: "Elite",
};

export const FAMILY_TIER_COLORS: Record<FamilyTier, string> = {
  ferro: "hsl(220 10% 60%)",
  bronze: "hsl(25 60% 55%)",
  prata: "hsl(220 15% 70%)",
  ouro: "hsl(45 90% 55%)",
  elite: "hsl(258 82% 66%)",
};

/**
 * Computes family reputation score (0–100) from three axes:
 * - Solidez (40pts): collective pledge payment rate
 * - Liquidez (40pts): total paid volume (R$100 = 1pt, cap 40 = R$4 000)
 * - Tempo (20pts): months with at least one paid pledge (2pts each, cap 10 months)
 */
export async function computeAndSaveFamilyReputation(familyId: string): Promise<number> {
  const pledges = await prisma.pledge.findMany({
    where: { wishlistItem: { familyId }, status: "active" },
    select: { amountCents: true, paidAt: true },
  });

  if (pledges.length === 0) {
    await prisma.family.update({ where: { id: familyId }, data: { familyScore: 0 } });
    return 0;
  }

  const paid = pledges.filter((p) => p.paidAt !== null);

  // 1. Solidez — up to 40 pts
  const solidezScore = Math.round((paid.length / pledges.length) * 40);

  // 2. Liquidez — up to 40 pts (R$100 = 1pt)
  const totalPaidCents = paid.reduce((s, p) => s + p.amountCents, 0);
  const liquidezScore = Math.min(40, Math.floor(totalPaidCents / 10_000));

  // 3. Tempo — up to 20 pts (2pts per active month, cap 10 months)
  const activeMonths = new Set(
    paid.map((p) => `${p.paidAt!.getFullYear()}-${p.paidAt!.getMonth()}`)
  ).size;
  const tempoScore = Math.min(20, activeMonths * 2);

  const score = Math.min(100, solidezScore + liquidezScore + tempoScore);

  await prisma.family.update({ where: { id: familyId }, data: { familyScore: score } });
  return score;
}
