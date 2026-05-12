import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const BallotSchema = z.object({
  choice: z.enum(["yes", "no", "abstain"]),
});

export async function POST(req: NextRequest, { params }: { params: { voteId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, BallotSchema);
  if (isApiError(body)) return body;

  const vote = await prisma.vote.findUnique({ where: { id: params.voteId } });
  if (!vote) return err("NOT_FOUND", "Vote not found", 404);
  if (vote.status !== "open") return err("VOTE_CLOSED", "This vote is no longer open");
  if (vote.closesAt < new Date()) {
    await prisma.vote.update({ where: { id: vote.id }, data: { status: "closed" } });
    return err("VOTE_CLOSED", "This vote has expired");
  }

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: vote.familyId } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not a member of this family", 403);
  }

  const ballot = await prisma.voteBallot.upsert({
    where: { voteId_userId: { voteId: params.voteId, userId: user.id } },
    update: { choice: body.choice, castAt: new Date() },
    create: { voteId: params.voteId, userId: user.id, choice: body.choice },
  });

  return ok(ballot);
}
