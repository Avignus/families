import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { createNotification } from "@/lib/notifications/service";
import { refundPayment } from "@/lib/payment";

const SPOT_COMMISSION_RATE = 0.12;

export const dynamic = "force-dynamic";

/** GET — returns current verification status for the buyer's membership */
export async function GET(
  _req: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { id: params.membershipId },
    select: {
      userId: true,
      spotVerifStatus: true,
      spotVerifDeadline: true,
      spotVerifImageUrl: true,
      spotVerifNotes: true,
      spotEscrowCents: true,
      family: {
        select: {
          chief: { select: { personaName: true, avatarMedium: true, steamId: true } },
        },
      },
    },
  });

  if (!membership) return err("NOT_FOUND", "Membership not found", 404);
  if (membership.userId !== user.id) return err("FORBIDDEN", "Not your membership", 403);

  return ok({
    status: membership.spotVerifStatus,
    deadline: membership.spotVerifDeadline,
    imageUrl: membership.spotVerifImageUrl,
    notes: membership.spotVerifNotes,
    chief: membership.family?.chief ?? null,
  });
}

/** POST — buyer uploads screenshot of Steam family; AI verifies; releases escrow if valid */
export async function POST(
  req: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { id: params.membershipId },
    include: {
      family: { select: { id: true, name: true, chiefId: true, currency: true } },
      user: { select: { id: true, personaName: true, steamId: true } },
    },
  });

  if (!membership) return err("NOT_FOUND", "Membership not found", 404);
  if (membership.userId !== user.id) return err("FORBIDDEN", "Not your membership", 403);
  if (membership.spotVerifStatus !== "pending") {
    return err("INVALID_STATE", `Verification status is '${membership.spotVerifStatus}', expected 'pending'`);
  }
  if (membership.spotVerifDeadline && membership.spotVerifDeadline < new Date()) {
    return err("EXPIRED", "Verification deadline has passed", 400);
  }

  // Parse multipart form data
  const formData = await req.formData().catch(() => null);
  if (!formData) return err("BAD_REQUEST", "Expected multipart/form-data", 400);

  const file = formData.get("image") as File | null;
  if (!file) return err("BAD_REQUEST", "image field is required", 400);
  if (!file.type.startsWith("image/")) return err("BAD_REQUEST", "Must be an image file", 400);
  if (file.size > 10 * 1024 * 1024) return err("BAD_REQUEST", "Image must be under 10MB", 400);

  // Upload to Vercel Blob
  const blob = await put(`spot-verification/${params.membershipId}/${Date.now()}-${file.name}`, file, {
    access: "private",
  }).catch((e) => {
    console.error("Blob upload error:", e);
    return null;
  });

  if (!blob) {
    return err("UPLOAD_FAILED", "Failed to upload image. Please try again.", 500);
  }

  // Analyse with Claude vision
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const imageBytes = Buffer.from(await file.arrayBuffer());
  const base64Image = imageBytes.toString("base64");
  const mediaType = (file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif");

  let verified = false;
  let aiNotes = "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            {
              type: "text",
              text: `This screenshot was submitted as proof that the Steam user "${membership.user.personaName}" is a member of a Steam Family group.

Examine the screenshot carefully and answer:
1. Does this appear to be a genuine Steam interface screenshot?
2. Can you see "${membership.user.personaName}" listed as a family member?
3. Is there any obvious sign of image manipulation?

Reply with VERIFIED if the user clearly appears as a Steam Family member, or REJECTED with a brief reason if not. Start your reply with exactly one of: VERIFIED or REJECTED.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    verified = text.trimStart().toUpperCase().startsWith("VERIFIED");
    aiNotes = text.slice(0, 500);
  } catch (e) {
    console.error("Claude vision error:", e);
    // On AI failure, give benefit of doubt to buyer after manual review flag
    aiNotes = "AI analysis unavailable — manual review required";
  }

  if (verified) {
    // Release escrow: credit chief's earnings
    const chiefAmountCents = membership.spotEscrowCents ?? 0;

    await prisma.$transaction(async (tx) => {
      await tx.familyMembership.update({
        where: { id: params.membershipId },
        data: {
          spotVerifStatus: "verified",
          spotVerifImageUrl: blob.url,
          spotVerifNotes: aiNotes,
        },
      });

      if (chiefAmountCents > 0) {
        await tx.user.update({
          where: { id: membership.family.chiefId },
          data: { chiefSpotEarningsCents: { increment: chiefAmountCents } },
        });
      }

      await createNotification(tx, {
        recipientUserId: membership.userId,
        type: "SPOT_VERIFIED",
        payload: { familyId: membership.family.id, familyName: membership.family.name },
      });

      await createNotification(tx, {
        recipientUserId: membership.family.chiefId,
        type: "SPOT_VERIFIED",
        payload: {
          familyId: membership.family.id,
          familyName: membership.family.name,
          memberId: membership.userId,
          personaName: membership.user.personaName,
          releasedCents: chiefAmountCents,
          currency: membership.family.currency,
        },
      });
    });

    return ok({ verified: true, message: "Verificação confirmada! O pagamento foi liberado para o chefe da família." });
  }

  // Not verified — save the attempt and let buyer retry until deadline
  await prisma.familyMembership.update({
    where: { id: params.membershipId },
    data: {
      spotVerifImageUrl: blob.url,
      spotVerifNotes: aiNotes,
    },
  });

  return ok({
    verified: false,
    message: "Não foi possível confirmar sua presença na família Steam com esta imagem. Por favor, tire um print mais claro mostrando seu nome na lista de membros e tente novamente.",
    aiNotes,
  });
}

/** DELETE — buyer claims they were NOT added to Steam family and requests refund */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { id: params.membershipId },
    include: {
      family: { select: { id: true, name: true, chiefId: true, currency: true } },
      user: { select: { id: true, personaName: true } },
    },
  });

  if (!membership) return err("NOT_FOUND", "Membership not found", 404);
  if (membership.userId !== user.id) return err("FORBIDDEN", "Not your membership", 403);
  if (membership.spotVerifStatus !== "pending") {
    return err("INVALID_STATE", "Can only request refund while verification is pending");
  }

  // Refund the buyer
  let refunded = false;
  if (membership.pixPaymentId && membership.feeChargedCents) {
    try {
      await refundPayment(membership.pixPaymentId, membership.feeChargedCents);
      refunded = true;
    } catch (e) {
      console.error("Spot refund error:", e);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: params.membershipId },
      data: {
        status: "rejected",
        spotVerifStatus: "expired",
        feeRefundedAt: refunded ? new Date() : null,
      },
    });

    const amountFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: membership.family.currency,
    }).format((membership.feeChargedCents ?? 0) / 100);

    await createNotification(tx, {
      recipientUserId: membership.userId,
      type: "JOIN_REJECTED",
      payload: {
        familyId: membership.family.id,
        familyName: membership.family.name,
        refunded,
        refundAmountFormatted: refunded ? amountFormatted : null,
      },
    });

    await createNotification(tx, {
      recipientUserId: membership.family.chiefId,
      type: "SPOT_VERIFICATION_EXPIRED",
      payload: {
        familyId: membership.family.id,
        familyName: membership.family.name,
        memberId: membership.userId,
        personaName: membership.user.personaName,
        refunded,
        amountFormatted,
      },
    });
  });

  return ok({ refunded, message: refunded ? "Estorno iniciado. Você receberá o valor de volta em até 3 dias úteis." : "Solicitação registrada. Entraremos em contato." });
}
