import { prisma } from "@/lib/prisma";

export type ReputationTier = "bronze" | "prata" | "ouro" | "elite";

export function getTier(score: number): ReputationTier {
  if (score >= 86) return "elite";
  if (score >= 61) return "ouro";
  if (score >= 31) return "prata";
  return "bronze";
}

export const TIER_LABELS: Record<ReputationTier, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  elite: "Elite",
};

export const TIER_COLORS: Record<ReputationTier, string> = {
  bronze: "hsl(25 60% 55%)",
  prata: "hsl(220 15% 65%)",
  ouro: "hsl(45 90% 55%)",
  elite: "hsl(258 82% 66%)",
};

export async function computeAndSaveReputation(userId: string): Promise<number> {
  const pledges = await prisma.pledge.findMany({
    where: { pledgerUserId: userId, status: "active" },
    include: { wishlistItem: { select: { status: true } } },
  });

  if (pledges.length === 0) {
    await prisma.user.update({ where: { id: userId }, data: { reputationScore: 0 } });
    return 0;
  }

  const paid = pledges.filter((p) => p.paidAt);
  const total = pledges.length;

  // 1. Payment rate — up to 40 pts
  const paymentRate = paid.length / total;
  const rateScore = Math.round(paymentRate * 40);

  // 2. Volume paid — up to 30 pts (R$10 = 1pt, capped at 30)
  const totalPaidCents = paid.reduce((s, p) => s + p.amountCents, 0);
  const volumeScore = Math.min(30, Math.floor(totalPaidCents / 1000));

  // 3. Payment speed — up to 20 pts
  const speedScores: number[] = paid.map((p) => {
    const hours = (p.paidAt!.getTime() - p.createdAt.getTime()) / 3_600_000;
    if (hours <= 2) return 20;
    if (hours <= 24) return 15;
    if (hours <= 72) return 10;
    if (hours <= 168) return 5;
    return 0;
  });
  const speedScore = speedScores.length > 0
    ? Math.round(speedScores.reduce((s, v) => s + v, 0) / speedScores.length)
    : 0;

  // 4. Games funded (contributed to funded or purchased items) — up to 10 pts
  const fundedGames = new Set(
    pledges
      .filter((p) => p.paidAt && ["funded", "purchased"].includes(p.wishlistItem.status))
      .map((p) => p.wishlistItemId)
  ).size;
  const fundedScore = Math.min(10, fundedGames * 2);

  const score = Math.min(100, rateScore + volumeScore + speedScore + fundedScore);

  await prisma.user.update({ where: { id: userId }, data: { reputationScore: score } });
  return score;
}
