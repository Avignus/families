import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { getAppBaseUrl } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";
import { createPixPayment, SERVICE_FEE_RATE, ASAAS_MIN_CHARGE_CENTS } from "@/lib/asaas";
import { debitWallet } from "@/lib/wallet";
import { maybeDisburseFunds } from "@/lib/disbursement";

const PledgeSchema = z.object({
  amountCents: z.number().int().positive(),
});

const recentPledges = new Map<string, number>();

export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const rateLimitKey = `${user.id}:${params.itemId}`;
  if (Date.now() - (recentPledges.get(rateLimitKey) ?? 0) < 1000) {
    return err("RATE_LIMITED", "Aguarde antes de contribuir novamente", 429);
  }
  recentPledges.set(rateLimitKey, Date.now());

  const body = await parseBody(req, PledgeSchema);
  if (isApiError(body)) return body;

  // Fetch Steam data before transaction — external API call, cannot be inside a tx
  const wishlistItemForSteam = await prisma.wishlistItem.findUnique({
    where: { id: params.itemId },
    select: { steamAppId: true },
  });
  const steamData = wishlistItemForSteam
    ? await getAppDetails(wishlistItemForSteam.steamAppId)
    : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wishlistItem = await tx.wishlistItem.findUnique({
        where: { id: params.itemId },
        include: { family: true },
      });

      if (!wishlistItem) {
        throw Object.assign(new Error("Wishlist item não encontrado"), { code: "NOT_FOUND", status: 404 });
      }
      if (wishlistItem.status !== "open" && wishlistItem.status !== "funded") {
        throw Object.assign(new Error("Este item não está aberto para contribuições"), { code: "ITEM_NOT_OPEN", status: 400 });
      }
      const membership = await tx.familyMembership.findUnique({
        where: { userId_familyId: { userId: user.id, familyId: wishlistItem.familyId } },
      });
      if (!membership || membership.status !== "active") {
        throw Object.assign(new Error("Você não é membro desta família"), { code: "FORBIDDEN", status: 403 });
      }

      const aggregate = await tx.pledge.aggregate({
        where: { wishlistItemId: params.itemId, status: "active", paidAt: { not: null } },
        _sum: { amountCents: true },
      });
      const currentTotal = aggregate._sum.amountCents ?? 0;
      const remaining = wishlistItem.targetPriceCents - currentTotal;

      if (body.amountCents > remaining) {
        throw Object.assign(
          new Error(`Valor excede o restante: R$ ${(remaining / 100).toFixed(2)} disponível`),
          { code: "EXCEEDS_TARGET", status: 400 }
        );
      }

      // Determine credits vs PIX split
      const dbUser = await tx.user.findUnique({ where: { id: user.id }, select: { creditsCents: true } });
      const availableCredits = dbUser?.creditsCents ?? 0;
      const creditsUsed = Math.min(availableCredits, body.amountCents);
      const pixPortion = body.amountCents - creditsUsed;

      // Validate PIX minimum before doing anything irreversible
      if (pixPortion > 0) {
        const pixAmountCents = Math.ceil(pixPortion * (1 + SERVICE_FEE_RATE));
        if (pixAmountCents < ASAAS_MIN_CHARGE_CENTS) {
          const minPledge = Math.ceil(ASAAS_MIN_CHARGE_CENTS / (1 + SERVICE_FEE_RATE));
          throw Object.assign(
            new Error(`Contribuição mínima via PIX é R$ ${(minPledge / 100).toFixed(2).replace(".", ",")}${creditsUsed > 0 ? ` (você tem R$ ${(creditsUsed / 100).toFixed(2)} em créditos já aplicados)` : ""}`),
            { code: "BELOW_MINIMUM", status: 400 }
          );
        }
      }

      const pledge = await tx.pledge.create({
        data: {
          wishlistItemId: params.itemId,
          pledgerUserId: user.id,
          amountCents: body.amountCents,
          creditsCentsUsed: creditsUsed,
          status: "active",
          pixStatus: pixPortion === 0 ? "approved" : "pending",
          paidAt: pixPortion === 0 ? new Date() : null,
        },
      });

      if (creditsUsed > 0) {
        await debitWallet(tx, user.id, creditsUsed, "pledge_payment", pledge.id);
      }

      // Only count immediately-paid amount (credits). PIX pledges are pending until webhook confirms.
      const paidNow = creditsUsed;
      const newTotal = currentTotal + paidNow;
      const isFunded = newTotal >= wishlistItem.targetPriceCents;

      if (isFunded) {
        await tx.wishlistItem.update({ where: { id: params.itemId }, data: { status: "funded" } });
      }

      const gameName = steamData?.name ?? `App #${wishlistItem.steamAppId}`;
      const percent = Math.round((body.amountCents / wishlistItem.targetPriceCents) * 100);

      return { pledge, isFunded, newTotal, percent, gameName, wishlistItem, creditsUsed, pixPortion };
    }, { timeout: 15000 });

    // Send notifications outside the transaction (avoid tx timeout)
    const notifPayloadBase = {
      pledgeId: result.pledge.id,
      itemId: params.itemId,
      familyId: result.wishlistItem.familyId,
      familyName: result.wishlistItem.family.name,
      ownerUserId: result.wishlistItem.ownerUserId ?? "",
      gameName: result.gameName,
      pledgerId: user.id,
      personaName: user.personaName,
      amountCents: body.amountCents,
      currency: result.wishlistItem.currency,
      percent: result.percent,
    };
    if (result.wishlistItem.ownerUserId && result.wishlistItem.ownerUserId !== user.id) {
      createNotification(prisma, { recipientUserId: result.wishlistItem.ownerUserId, type: "PLEDGE_RECEIVED", payload: notifPayloadBase }).catch(() => {});
    }
    if (result.isFunded && result.wishlistItem.ownerUserId) {
      createNotification(prisma, { recipientUserId: result.wishlistItem.ownerUserId, type: "ITEM_FUNDED", payload: { itemId: params.itemId, familyId: result.wishlistItem.familyId, familyName: result.wishlistItem.family.name, ownerUserId: result.wishlistItem.ownerUserId, gameName: result.gameName, currency: result.wishlistItem.currency } }).catch(() => {});
    }

    // Fully covered by credits — no PIX charge needed
    if (result.pixPortion === 0) {
      maybeDisburseFunds(params.itemId).catch(() => {});
      return ok({ pledge: result.pledge, isFunded: result.isFunded, newTotal: result.newTotal, percent: result.percent, pix: null }, 201);
    }

    // Create PIX payment for the remaining portion (outside transaction)
    const baseUrl = getAppBaseUrl(req);
    const pixAmountCents = Math.ceil(result.pixPortion * (1 + SERVICE_FEE_RATE));

    try {
      const pix = await createPixPayment({
        amountCents: pixAmountCents,
        description: `Families — ${result.gameName}`,
        payerSteamId: user.steamId,
        payerName: user.personaName,
        externalReference: `pledge:${result.pledge.id}`,
        notificationUrl: `${baseUrl}/api/webhooks/asaas`,
      });

      await prisma.pledge.update({
        where: { id: result.pledge.id },
        data: {
          pixPaymentId: pix.paymentId,
          pixAmountCents,
          pixStatus: pix.status,
          pixQrCode: pix.qrCode,
          pixQrCodeBase64: pix.qrCodeBase64,
          pixTicketUrl: pix.ticketUrl,
        },
      });

      return ok({
        pledge: result.pledge,
        isFunded: result.isFunded,
        newTotal: result.newTotal,
        percent: result.percent,
        pix,
        creditsUsed: result.creditsUsed,
      }, 201);

    } catch (mpError) {
      console.error("Asaas PIX creation error:", mpError);

      // Rollback: remove pledge and revert item status so the user can try again
      await prisma.pledge.delete({ where: { id: result.pledge.id } }).catch(() => {});
      if (result.isFunded) {
        await prisma.wishlistItem.update({
          where: { id: params.itemId },
          data: { status: "open" },
        }).catch(() => {});
      }

      const message = mpError instanceof Error ? mpError.message : "Erro ao criar pagamento PIX";
      return err("PAYMENT_ERROR", message, 502);
    }

  } catch (e: unknown) {
    const error = e as Error & { code?: string; status?: number };
    if (error.code) return err(error.code, error.message, error.status ?? 400);
    console.error("Pledge error:", e);
    return err("INTERNAL_ERROR", "Erro interno ao processar contribuição", 500);
  }
}

