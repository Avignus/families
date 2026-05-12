import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  await prisma.notification.updateMany({
    where: { recipientUserId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ message: "All notifications marked as read" });
}
