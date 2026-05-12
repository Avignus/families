import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const notification = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notification) return err("NOT_FOUND", "Notification not found", 404);
  if (notification.recipientUserId !== user.id) return err("FORBIDDEN", "Not your notification", 403);

  await prisma.notification.update({
    where: { id: params.id },
    data: { readAt: new Date() },
  });

  return ok({ message: "Marked as read" });
}
