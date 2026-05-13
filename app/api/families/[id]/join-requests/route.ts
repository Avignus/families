import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { createPixPayment, ENTRY_FEE_SERVICE_RATE } from "@/lib/mercadopago";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: { chief: { select: { id: true, personaName: true } } },
  });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const memberCount = await prisma.familyMembership.count({
    where: { familyId: params.id, status: "active" },
  });
  if (family.maxMembers && memberCount >= family.maxMembers) {
    return err("FAMILY_FULL", "This family has no available spots", 409);
  }

  const existing = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });

  if (existing) {
    if (existing.status === "active") return err("ALREADY_MEMBER", "Already a member of this family");
    if (existing.status === "pending") {
      // Already has a valid pending PIX — return it
      if (existing.mpPaymentId && !existing.feePaidAt) {
        return ok({
          message: "Join request pending payment",
          pendingPayment: true,
          pix: {
            qrCode: existing.mpQrCode,
            qrCodeBase64: existing.mpQrCodeBase64,
            ticketUrl: existing.mpTicketUrl,
            paymentId: existing.mpPaymentId,
          },
        });
      }
      // Pending without PIX (free family or previous PIX failure) — allow retry if paid family
      if (!family.entryFeeCents) {
        return err("ALREADY_PENDING", "Join request already pending");
      }
      // Fall through to retry PIX creation below
    }
  }

  // No entry fee — create pending membership and notify chief
  if (!family.entryFeeCents) {
    if (existing) {
      await prisma.familyMembership.update({
        where: { id: existing.id },
        data: { status: "pending", joinedAt: new Date() },
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.create({
          data: { userId: user.id, familyId: params.id, status: "pending" },
        });
        await createNotification(tx, {
          recipientUserId: family.chiefId,
          type: "JOIN_REQUEST",
          payload: {
            familyId: family.id,
            familyName: family.name,
            requesterId: user.id,
            personaName: user.personaName,
          },
        });
      });
    }
    return ok({ message: "Join request sent" }, 201);
  }

  // Has entry fee — create membership + PIX payment
  const membership = existing
    ? await prisma.familyMembership.update({
        where: { id: existing.id },
        data: { status: "pending", joinedAt: new Date() },
      })
    : await prisma.familyMembership.create({
        data: { userId: user.id, familyId: params.id, status: "pending" },
      });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "";

  // Charge entry fee + 15% service fee; only entry fee is refundable on rejection
  const totalChargeCents = Math.ceil(family.entryFeeCents * (1 + ENTRY_FEE_SERVICE_RATE));

  let pix = null;
  try {
    pix = await createPixPayment({
      amountCents: totalChargeCents,
      description: `Taxa de entrada — ${family.name}`,
      payerSteamId: user.steamId,
      pledgeId: `membership:${membership.id}`,
      notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
    });

    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: {
        mpPaymentId: pix.paymentId,
        mpStatus: pix.status,
        mpQrCode: pix.qrCode,
        mpQrCodeBase64: pix.qrCodeBase64,
        mpTicketUrl: pix.ticketUrl,
        feeChargedCents: totalChargeCents,
      },
    });
  } catch (mpErr: unknown) {
    const mpMsg = mpErr instanceof Error ? mpErr.message : JSON.stringify(mpErr);
    console.error("MercadoPago entry fee error:", mpMsg);
    // PIX failed — keep membership pending, notify chief to handle manually
    await createNotification(prisma, {
      recipientUserId: family.chiefId,
      type: "JOIN_REQUEST",
      payload: {
        familyId: family.id,
        familyName: family.name,
        requesterId: user.id,
        personaName: user.personaName,
      },
    });
    return err("PIX_UNAVAILABLE", "Não foi possível gerar o PIX no momento. Tente novamente em alguns instantes.", 503);
  }

  return ok({
    message: "Pay the entry fee to complete your request",
    pendingPayment: true,
    pix: {
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      paymentId: pix.paymentId,
    },
  }, 201);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can view join requests", 403);

  const requests = await prisma.familyMembership.findMany({
    where: { familyId: params.id, status: "pending" },
    include: { user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true, steamId: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return ok(requests);
}
