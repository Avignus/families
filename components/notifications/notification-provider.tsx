"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { playAchievementSound } from "@/lib/achievement-sound";

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

const RARITY_COLORS: Record<string, string> = {
  lendario: "#e8587a",
  raro: "#8830d8",
  incomum: "#3b82f6",
  comum: "#6b7280",
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

function showNotificationToast(notification: Notification) {
  const payload = notification.payload as Record<string, string | number>;

  if (notification.type === "ACHIEVEMENT_UNLOCKED") {
    const rarity = String(payload.rarity ?? "comum");
    const color = RARITY_COLORS[rarity] ?? RARITY_COLORS.comum;
    playAchievementSound();
    toast.custom(
      () => (
        <div
          style={{ borderLeft: `4px solid ${color}` }}
          className="flex items-center gap-3 bg-card border border-border rounded-lg shadow-xl px-4 py-3 w-80"
        >
          <div
            style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          >
            <Trophy className="h-5 w-5" style={{ color }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
              Conquista desbloqueada
            </span>
            <span className="text-sm font-semibold text-foreground leading-tight truncate">
              {String(payload.title ?? "")}
            </span>
            <span className="text-xs text-muted-foreground leading-tight line-clamp-2 mt-0.5">
              {String(payload.description ?? "")}
            </span>
          </div>
        </div>
      ),
      { position: "top-center", duration: 6000 }
    );
    return;
  }

  // Regular notification — bottom right, plain toast
  const gameName = payload.gameName ? String(payload.gameName) : null;
  const personaName = payload.personaName ? String(payload.personaName) : null;
  const familyName = payload.familyName ? String(payload.familyName) : null;

  const msg = gameName
    ? `${personaName ?? "Alguém"} — ${gameName}`
    : familyName ?? notification.type.replace(/_/g, " ");

  toast(msg, { position: "bottom-right", duration: 4000 });
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchNotifications = async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/notifications?unread=false");
      if (!res.ok) return;
      const data = await res.json();
      const items: Notification[] = data.data?.items ?? [];
      setNotifications(items);
      items.forEach((n) => seenIds.current.add(n.id));
    } catch {}
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    fetchNotifications();

    const connectSSE = () => {
      esRef.current?.close();
      const es = new EventSource("/api/notifications/stream");
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const notification = JSON.parse(e.data) as Notification;
          // Dedup — SSE can fire while Asaas retries webhook
          if (seenIds.current.has(notification.id)) return;
          seenIds.current.add(notification.id);

          setNotifications((prev) => [notification, ...prev]);
          showNotificationToast(notification);
        } catch {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
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
