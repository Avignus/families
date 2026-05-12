import { NotificationType, PrismaClient } from "@prisma/client";
import { pushNotification } from "./sse";

// Creates a notification row inside an existing transaction, then pushes SSE.
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

  // Push SSE after DB write succeeds (still in the transaction flow)
  pushNotification(params.recipientUserId, {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    createdAt: notification.createdAt,
  });

  return notification;
}
