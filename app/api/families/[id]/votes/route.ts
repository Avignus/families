import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";

const CreateVoteSchema = z.object({
  steamAppId: z.number().int().positive(),
  closesAt: z.string().datetime(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member of this family", 403);
  }

  const body = await parseBody(req, CreateVoteSchema);
  if (isApiError(body)) return body;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const steamData = await getAppDetails(body.steamAppId);
  const gameName = steamData?.name ?? `App #${body.steamAppId}`;

  const members = await prisma.familyMembership.findMany({
    where: { familyId: params.id, status: "active" },
    select: { userId: true },
  });

  const vote = await prisma.$transaction(async (tx) => {
    const v = await tx.vote.create({
      data: {
        familyId: params.id,
        steamAppId: body.steamAppId,
        openedByUserId: user.id,
        closesAt: new Date(body.closesAt),
        status: "open",
      },
    });

    // Notify all family members except the opener
    for (const m of members) {
      if (m.userId === user.id) continue;
      await createNotification(tx, {
        recipientUserId: m.userId,
        type: "VOTE_OPENED",
        payload: {
          voteId: v.id,
          familyId: family.id,
          familyName: family.name,
          steamAppId: body.steamAppId,
          gameName,
          personaName: user.personaName,
        },
      });
    }

    return v;
  });

  return ok(vote, 201);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not a member of this family", 403);
  }

  // Lazily close expired votes
  await prisma.vote.updateMany({
    where: { familyId: params.id, status: "open", closesAt: { lt: new Date() } },
    data: { status: "closed" },
  });

  const votes = await prisma.vote.findMany({
    where: { familyId: params.id },
    include: {
      openedBy: { select: { id: true, personaName: true, avatarUrl: true } },
      ballots: { include: { user: { select: { id: true, personaName: true, avatarUrl: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    votes.map(async (v) => {
      const steamData = await getAppDetails(v.steamAppId);
      const tally = { yes: 0, no: 0, abstain: 0 };
      for (const b of v.ballots) tally[b.choice]++;
      const myBallot = v.ballots.find((b) => b.userId === user.id);
      return { ...v, steamData, tally, myBallot: myBallot?.choice ?? null };
    })
  );

  return ok(enriched);
}
