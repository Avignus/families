import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(9).toString("base64url"); // 12 chars, URL-safe
}

// POST → generate (or regenerate) invite token
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Família não encontrada", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Apenas o chefe pode gerar convites", 403);

  let token = generateToken();
  // Retry on collision (extremely unlikely but safe)
  for (let i = 0; i < 3; i++) {
    const exists = await prisma.family.findUnique({ where: { inviteToken: token } });
    if (!exists) break;
    token = generateToken();
  }

  await prisma.family.update({ where: { id: params.id }, data: { inviteToken: token } });
  return ok({ token });
}

// DELETE → revoke invite token
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Família não encontrada", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Apenas o chefe pode revogar convites", 403);

  await prisma.family.update({ where: { id: params.id }, data: { inviteToken: null } });
  return ok({ message: "Convite revogado" });
}
