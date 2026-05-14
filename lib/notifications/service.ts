import { NotificationType, PrismaClient } from "@prisma/client";
import { pushNotification } from "./sse";
import { sendNotificationEmail } from "@/lib/email";

// Creates a notification row inside an existing transaction, then pushes SSE + email.
// Must be called within a transaction (pass the tx client).
export async function createNotification(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  params: {
    recipientUserId: string;
    type: NotificationType;
    payload: Record<string, string | number | boolean | null>;
  }
) {
  const notification = await tx.notification.create({
    data: {
      recipientUserId: params.recipientUserId,
      type: params.type,
      payload: params.payload,
    },
  });

  pushNotification(params.recipientUserId, {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    createdAt: notification.createdAt,
  });

  // Fire-and-forget email — only sends if user has an email and type is high-value
  tx.user.findUnique({ where: { id: params.recipientUserId }, select: { email: true } })
    .then((user) => {
      if (user?.email) {
        return sendNotificationEmail({ to: user.email, type: params.type, payload: params.payload });
      }
    })
    .catch((err) => console.error("Email notification error:", err));

  return notification;
}
