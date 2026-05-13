import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { createPixPayment, ENTRY_FEE_SERVICE_RATE } from "@/lib/mercadopago";
import { getPlayerSummaries } from "@/lib/steam";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await handlePost(req, params);
  } catch (e: unknown) {
    console.error("[join-requests POST]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return err("INTERNAL_ERROR", msg, 500);
  }
}

async function handlePost(req: NextRequest, params: { id: string }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  // Always use the latest personaName from DB, refreshing from Steam if still a fallback name
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { personaName: true, steamId: true },
  });
  let personaName = dbUser?.personaName ?? user.personaName;
  if (personaName.startsWith("Steam user") && dbUser?.steamId) {
    const [player] = await getPlayerSummaries([dbUser.steamId]).catch(() => []);
    if (player?.personaname) {
      personaName = player.personaname;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          personaName: player.personaname,
          avatarUrl: player.avatar,
          avatarMedium: player.avatarmedium,
          avatarFull: player.avatarfull,
        },
      });
    }
  }

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
            expiresAt: new Date(existing.joinedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
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
            personaName,
          },
        });
      });
    }
    return ok({ message: "Join request sent" }, 201);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "";
  const totalChargeCents = Math.ceil(family.entryFeeCents * (1 + ENTRY_FEE_SERVICE_RATE));

  // Generate PIX before creating membership — only persist if payment was created successfully
  let pix;
  const tempRef = `membership-temp:${user.id}:${params.id}`;
  try {
    pix = await createPixPayment({
      amountCents: totalChargeCents,
      description: `Taxa de entrada — ${family.name}`,
      payerSteamId: user.steamId,
      pledgeId: tempRef,
      notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
    });
  } catch (mpErr: unknown) {
    const mpMsg = mpErr instanceof Error ? mpErr.message : JSON.stringify(mpErr);
    console.error("MercadoPago entry fee error:", mpMsg);
    return err("PIX_UNAVAILABLE", "Não foi possível gerar o PIX no momento. Tente novamente em alguns instantes.", 503);
  }

  // PIX created — now persist the membership with payment data
  const membership = existing
    ? await prisma.familyMembership.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          joinedAt: new Date(),
          mpPaymentId: pix.paymentId,
          mpStatus: pix.status,
          mpQrCode: pix.qrCode,
          mpQrCodeBase64: pix.qrCodeBase64,
          mpTicketUrl: pix.ticketUrl,
          feeChargedCents: totalChargeCents,
        },
      })
    : await prisma.familyMembership.create({
        data: {
          userId: user.id,
          familyId: params.id,
          status: "pending",
          mpPaymentId: pix.paymentId,
          mpStatus: pix.status,
          mpQrCode: pix.qrCode,
          mpQrCodeBase64: pix.qrCodeBase64,
          mpTicketUrl: pix.ticketUrl,
          feeChargedCents: totalChargeCents,
        },
      });

  // Update external_reference in MP to point to the real membership ID
  // (best-effort, webhook uses mpPaymentId to find membership so this is optional)
  void fetch(`https://api.mercadopago.com/v1/payments/${pix.paymentId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ external_reference: `membership:${membership.id}` }),
  }).catch(() => {});

  return ok({
    message: "Pay the entry fee to complete your request",
    pendingPayment: true,
    pix: {
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      paymentId: pix.paymentId,
      expiresAt: pix.expiresAt.toISOString(),
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
