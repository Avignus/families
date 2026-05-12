"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationContextValue = {
  unreadCount: number;
  recent: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  refetch: () => void;
};

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  recent: [],
  markRead: () => {},
  markAllRead: () => {},
  refetch: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/notifications?unread=false");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data?.items ?? []);
    } catch {}
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    fetchNotifications();

    // SSE connection
    const connectSSE = () => {
      esRef.current?.close();
      const es = new EventSource("/api/notifications/stream");
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const notification = JSON.parse(e.data) as Notification;
          setNotifications((prev) => [notification, ...prev]);

          const payload = notification.payload as Record<string, string>;
          const msg = payload.gameName
            ? `${payload.personaName ?? "Alguém"} — ${payload.gameName}`
            : payload.familyName ?? notification.type.replace(/_/g, " ");
          toast(msg, { duration: 5000 });
        } catch {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Fall back to polling every 30s
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchNotifications, 30000);
        }
      };
    };

    connectSSE();

    return () => {
      esRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications/read-all", { method: "POST" });
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const recent = notifications.slice(0, 20);

  return (
    <NotificationContext.Provider value={{ unreadCount, recent, markRead, markAllRead, refetch: fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
