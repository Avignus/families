import { NextRequest } from "next/server";
import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const params = req.nextUrl.searchParams;
  const unreadOnly = params.get("unread") === "true";
  const rawCursor = params.get("cursor");
  const cursor = rawCursor && /^[0-9a-f-]{36}$/.test(rawCursor) ? rawCursor : null;
  const limit = 20;

  const notifications = await prisma.notification.findMany({
    where: {
      recipientUserId: user.id,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return ok({ items, nextCursor });
}
