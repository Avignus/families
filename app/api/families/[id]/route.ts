import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails, getPlayerSummaries, resolveAppNames } from "@/lib/steam";
import { refundPayment } from "@/lib/asaas";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";

const UpdateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isPublic: z.boolean().optional(),
  description: z.string().max(300).nullable().optional(),
  maxMembers: z.number().int().min(2).max(100).nullable().optional(),
  entryFeeCents: z.number().int().min(0).optional(),
  spotPricingEnabled: z.boolean().optional(),
  spotFraction: z.number().min(0.01).max(1).optional(),
  spotMinPriceCents: z.number().int().min(0).optional(),
  autoApprove: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      chief: { select: { id: true, steamId: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      memberships: {
        where: { status: { in: ["active", "pending"] } },
        include: {
          user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true, steamId: true, reputationScore: true } },
        },
      },
      wishlistItems: {
        where: { status: { not: "cancelled" } },
        include: {
          owner: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
          pledges: {
            where: { status: "active" },
            include: {
              pledger: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      votes: {
        where: { status: "open" },
        include: {
          openedBy: { select: { id: true, personaName: true } },
          ballots: { include: { user: { select: { id: true, personaName: true } } } },
        },
        orderBy: { closesAt: "asc" },
      },
      activeCoverTheme:   { select: { id: true, slug: true, name: true, config: true } },
      activeCoverOverlay: { select: { id: true, slug: true, name: true, config: true } },
      activeCoverVideo:   { select: { id: true, slug: true, name: true, config: true } },
      memberPersonalizations: {
        where: { userId: user.id },
        select: {
          coverTheme:   { select: { id: true, slug: true, name: true, config: true } },
          coverOverlay: { select: { id: true, slug: true, name: true, config: true } },
          coverVideo:   { select: { id: true, slug: true, name: true, config: true } },
        },
      },
    },
  });

  if (!family) return err("NOT_FOUND", "Family not found", 404);

  // Synchronously refresh any stale "Steam user" names before returning
  const allMembers = [family.chief, ...family.memberships.map((m) => m.user)];
  const stale = allMembers.filter((m) => m.personaName.startsWith("Steam user"));
  if (stale.length > 0) {
    const players = await getPlayerSummaries(stale.map((m) => m.steamId)).catch(() => []);
    await Promise.all(players.map((player) => {
      const member = stale.find((m) => m.steamId === player.steamid);
      if (!member) return;
      member.personaName = player.personaname;
      member.avatarUrl = player.avatar;
      member.avatarMedium = player.avatarmedium;
      return prisma.user.updateMany({
        where: { steamId: player.steamid },
        data: {
          personaName: player.personaname,
          avatarUrl: player.avatar,
          avatarMedium: player.avatarmedium,
          avatarFull: player.avatarfull,
        },
      });
    }));
  }

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not a member of this family", 403);
  }

  // Enrich wishlist items with cached Steam data + price intelligence
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const enrichedItems = await Promise.all(
    family.wishlistItems.map(async (item) => {
      const steamData = await getAppDetails(item.steamAppId);
      const totalPledged = item.pledges.reduce((s, p) => p.paidAt ? s + p.amountCents : s, 0);

      // Price intelligence: compute avg from 90-day history (if enough samples)
      let priceAlert: "low" | "high" | null = null;
      let priceAvgCents: number | null = null;
      const history = await prisma.steamPriceHistory.findMany({
        where: { steamAppId: item.steamAppId, recordedAt: { gte: cutoff } },
        select: { priceCents: true },
      });
      if (history.length >= 30 && steamData && steamData.priceCents > 0) {
        const avg = Math.round(history.reduce((s, h) => s + h.priceCents, 0) / history.length);
        priceAvgCents = avg;
        const ratio = steamData.priceCents / avg;
        if (ratio <= 0.80) priceAlert = "low";
        else if (ratio >= 1.20) priceAlert = "high";
      }

      return {
        ...item,
        steamData,
        totalPledgedCents: totalPledged,
        percentFunded: item.targetPriceCents > 0
          ? Math.round((totalPledged / item.targetPriceCents) * 100)
          : 0,
        priceAlert,
        priceAvgCents,
        pledges: item.pledges.map((p) => ({
          ...p,
          percent: item.targetPriceCents > 0
            ? Math.round((p.amountCents / item.targetPriceCents) * 100)
            : 0,
        })),
      };
    })
  );

  return ok({
    ...family,
    wishlistItems: enrichedItems,
    isChief: family.chiefId === user.id,
    currentUserId: user.id,
    monthlyBudgetCents: membership.monthlyBudgetCents,
    // Split memberships for the client
    memberships: family.memberships.filter((m) => m.status === "active"),
    pendingMemberships: family.chiefId === user.id
      ? await (async () => {
          const wishlistAppIds = new Set(family.wishlistItems.map((i) => i.steamAppId));

          // Build the combined library of all active members (one query, all caches)
          const activeMembers = family.memberships.filter((m) => m.status === "active");
          const activeCaches = await prisma.steamUserCache.findMany({
            where: {
              userId: { in: activeMembers.map((m) => m.user.steamId) },
              type: "library",
            },
          });
          const familyAppIds = new Set(
            activeCaches.flatMap((c) => (c.payload as Array<{ appId: number }>).map((g) => g.appId))
          );

          return Promise.all(
            family.memberships
              .filter((m) => m.status === "pending")
              .map(async (m) => {
                const cache = await prisma.steamUserCache.findUnique({
                  where: { userId_type: { userId: m.user.steamId, type: "library" } },
                });
                const ownedAppIds = cache
                  ? [...new Set((cache.payload as Array<{ appId: number }>).map((g) => g.appId))]
                  : null;
                const wishlistMatches: number[] | null = ownedAppIds
                  ? ownedAppIds.filter((id) => wishlistAppIds.has(id))
                  : null;
                // Games the candidate owns that no active family member has
                const extraAppIds = ownedAppIds
                  ? ownedAppIds.filter((id) => !familyAppIds.has(id)).slice(0, 6)
                  : [];
                const extraNameMap = await resolveAppNames(extraAppIds);
                const libraryExtras = extraAppIds.map((appId) => ({ appId, name: extraNameMap.get(appId) ?? null }));
                return { ...m, wishlistMatches, libraryExtras };
              })
          );
        })()
      : [],
    coverTheme:   family.memberPersonalizations?.[0]?.coverTheme   ?? family.activeCoverTheme   ?? null,
    coverOverlay: family.memberPersonalizations?.[0]?.coverOverlay ?? family.activeCoverOverlay ?? null,
    coverVideo:   family.memberPersonalizations?.[0]?.coverVideo   ?? family.activeCoverVideo   ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can update family settings", 403);

  const body = await parseBody(req, UpdateFamilySchema);
  if (isApiError(body)) return body;

  const updated = await prisma.family.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.maxMembers !== undefined && { maxMembers: body.maxMembers }),
      ...(body.entryFeeCents !== undefined && { entryFeeCents: body.entryFeeCents }),
      ...(body.spotPricingEnabled !== undefined && { spotPricingEnabled: body.spotPricingEnabled }),
      ...(body.spotFraction !== undefined && { spotFraction: body.spotFraction }),
      ...(body.spotMinPriceCents !== undefined && { spotMinPriceCents: body.spotMinPriceCents }),
      ...(body.autoApprove !== undefined && { autoApprove: body.autoApprove }),
    },
  });

  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      // Paid pledges on items not yet disbursed → need refund
      wishlistItems: {
        where: { disbursedAt: null },
        include: {
          pledges: {
            where: { status: "active", paidAt: { not: null } },
            select: {
              id: true,
              pledgerUserId: true,
              pixPaymentId: true,
              pixAmountCents: true,
              amountCents: true,
              creditsCentsUsed: true,
              wishlistItem: { select: { steamAppId: true } },
            },
          },
        },
      },
      // Paid entry fees not yet refunded → need refund
      memberships: {
        where: { feePaidAt: { not: null }, feeRefundedAt: null, userId: { not: user.id } },
        select: { id: true, userId: true, pixPaymentId: true, feeChargedCents: true },
      },
    },
  });

  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can delete the family", 403);

  const paidPledges = family.wishlistItems.flatMap((i) => i.pledges);
  const paidMemberships = family.memberships;

  // ── Refund paid pledges ──────────────────────────────────────────────────
  // Strategy: try Asaas first; if it fails (e.g. 90-day PIX window), fall back
  // to wallet credit so the user always recovers their money.
  type PledgeRefundResult = { pledgeId: string; pledgerUserId: string; steamAppId: number; refundCents: number; viaWallet: boolean };
  const pledgeRefunds: PledgeRefundResult[] = [];

  for (const pledge of paidPledges) {
    if (!pledge.pledgerUserId) continue;
    const pixCents = pledge.pixAmountCents ?? 0;
    const walletCents = pledge.creditsCentsUsed ?? 0;
    let viaWallet = false;

    if (pixCents > 0 && pledge.pixPaymentId) {
      try {
        await refundPayment(pledge.pixPaymentId, pixCents);
      } catch {
        // Asaas failed (expired window, etc.) → credit wallet instead
        viaWallet = true;
      }
    }

    pledgeRefunds.push({
      pledgeId: pledge.id,
      pledgerUserId: pledge.pledgerUserId,
      steamAppId: pledge.wishlistItem.steamAppId,
      refundCents: pixCents + walletCents,
      viaWallet,
    });
  }

  // ── Refund paid entry fees ───────────────────────────────────────────────
  type MembershipRefundResult = { membershipId: string; userId: string; refunded: boolean };
  const membershipRefunds: MembershipRefundResult[] = [];

  for (const membership of paidMemberships) {
    let refunded = false;
    if (membership.pixPaymentId && membership.feeChargedCents) {
      try {
        await refundPayment(membership.pixPaymentId, membership.feeChargedCents);
        refunded = true;
      } catch {
        console.error(`Entry fee refund failed for membership ${membership.id} on family deletion`);
      }
    }
    membershipRefunds.push({ membershipId: membership.id, userId: membership.userId, refunded });
  }

  // ── Get active members for FAMILY_DELETED notification ──────────────────
  const activeMembers = await prisma.familyMembership.findMany({
    where: { familyId: params.id, status: "active", userId: { not: user.id } },
    select: { userId: true },
  });

  // ── Load game names for pledge refund notifications ──────────────────────
  const appIds = [...new Set(pledgeRefunds.map((r) => r.steamAppId))];
  const gameNames = new Map<number, string>();
  await Promise.all(
    appIds.map(async (appId) => {
      const data = await getAppDetails(appId).catch(() => null);
      gameNames.set(appId, data?.name ?? `App #${appId}`);
    })
  );

  // ── Delete family + notify + re-credit wallets in transaction ────────────
  await prisma.$transaction(async (tx) => {
    // Re-credit wallet for pledges where Asaas failed or credits were used
    for (const r of pledgeRefunds) {
      if (r.viaWallet && r.refundCents > 0) {
        await creditWallet(tx, r.pledgerUserId, r.refundCents, "item_cancelled", r.pledgeId);
      } else if ((r.refundCents - (paidPledges.find((p) => p.id === r.pledgeId)?.pixAmountCents ?? 0)) > 0) {
        // Re-credit the wallet-credits portion even when PIX refund succeeded
        const walletPortion = paidPledges.find((p) => p.id === r.pledgeId)?.creditsCentsUsed ?? 0;
        if (walletPortion > 0) {
          await creditWallet(tx, r.pledgerUserId, walletPortion, "item_cancelled", r.pledgeId);
        }
      }

      await createNotification(tx, {
        recipientUserId: r.pledgerUserId,
        type: "PLEDGE_REFUNDED_FAMILY_DELETED",
        payload: {
          familyName: family.name,
          gameName: gameNames.get(r.steamAppId) ?? `App #${r.steamAppId}`,
          refundAmountFormatted: formatCurrency(r.refundCents, family.currency),
        },
      });
    }

    // Mark refunded memberships
    for (const r of membershipRefunds.filter((r) => r.refunded)) {
      await tx.familyMembership.update({
        where: { id: r.membershipId },
        data: { feeRefundedAt: new Date() },
      });
    }

    // Notify all active members
    for (const { userId } of activeMembers) {
      await createNotification(tx, {
        recipientUserId: userId,
        type: "FAMILY_DELETED",
        payload: { familyName: family.name },
      });
    }

    // Cascade delete
    await tx.voteBallot.deleteMany({ where: { vote: { familyId: params.id } } });
    await tx.vote.deleteMany({ where: { familyId: params.id } });
    await tx.pledge.deleteMany({ where: { wishlistItem: { familyId: params.id } } });
    await tx.wishlistItem.deleteMany({ where: { familyId: params.id } });
    await tx.familyMembership.deleteMany({ where: { familyId: params.id } });
    await tx.family.delete({ where: { id: params.id } });
  });

  return ok({ message: "Family deleted" });
}
