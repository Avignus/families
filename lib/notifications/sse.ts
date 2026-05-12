// In-memory SSE subscriber registry
// Maps userId -> set of response controllers

type SSEController = {
  enqueue: (data: string) => void;
  close: () => void;
};

const subscribers = new Map<string, Set<SSEController>>();

export function subscribe(userId: string, controller: SSEController): () => void {
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId)!.add(controller);

  return () => {
    subscribers.get(userId)?.delete(controller);
    if (subscribers.get(userId)?.size === 0) {
      subscribers.delete(userId);
    }
  };
}

export function pushNotification(userId: string, payload: object): void {
  const subs = subscribers.get(userId);
  if (!subs || subs.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const ctrl of subs) {
    try {
      ctrl.enqueue(data);
    } catch {
      // Connection closed — subscriber cleanup happens via the unsubscribe fn
    }
  }
}
