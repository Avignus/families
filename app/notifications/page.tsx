"use client";

import { useEffect } from "react";
import { useNotifications } from "@/components/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import Image from "next/image";

export default function NotificationsPage() {
  const { recent, unreadCount, markRead, markAllRead, refetch } = useNotifications();
  const { t } = useLanguage();

  useEffect(() => {
    if (unreadCount > 0) markAllRead();
  }, []);

  const getLink = (notification: { type: string; payload: Record<string, unknown> }) => {
    const p = notification.payload;
    if (p.familyId) {
      if (notification.type === "JOIN_REQUEST") return `/families/${p.familyId}/admin`;
      return `/families/${p.familyId}`;
    }
    return null;
  };

  return (
    <div className="container py-8 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          {t.notif.title}
          {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
        </h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> {t.notif.markAllRead}
          </Button>
        )}
      </div>

      {recent.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t.notif.none}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recent.map((n) => {
            const link = getLink(n as unknown as { type: string; payload: Record<string, unknown> });
            const payload = n.payload as Record<string, string>;
            const content = (
              <div
                className={`p-4 rounded-lg border transition-colors ${
                  !n.readAt
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {n.type === "ACHIEVEMENT_UNLOCKED" && payload.achievementSlug && (
                    <Image
                      src={`/badges/${payload.achievementSlug}.png`}
                      alt={payload.title ?? "achievement"}
                      width={44}
                      height={44}
                      className="shrink-0 object-contain"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {(t.notif.types as Record<string, string>)[n.type] ?? n.type}
                    </p>
                    <p className="text-sm">
                      {n.type === "ACHIEVEMENT_UNLOCKED" ? (
                        <span className="font-medium">{payload.title}</span>
                      ) : (
                        <>
                          {payload.gameName && (
                            <span className="font-medium">{payload.gameName} — </span>
                          )}
                          {payload.personaName && <span>{payload.personaName} </span>}
                          {payload.familyName && <span className="text-muted-foreground">em {payload.familyName}</span>}
                        </>
                      )}
                    </p>
                    {n.type === "ACHIEVEMENT_UNLOCKED" && payload.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{payload.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </div>
            );

            return link ? (
              <Link
                key={n.id}
                href={link}
                onClick={() => !n.readAt && markRead(n.id)}
              >
                {content}
              </Link>
            ) : (
              <div
                key={n.id}
                onClick={() => !n.readAt && markRead(n.id)}
                className="cursor-pointer"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
