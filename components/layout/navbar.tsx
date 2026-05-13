"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Bell, LogOut, Settings, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/components/notifications/notification-provider";
import { FamiliesLogo } from "./logo";
import { formatRelativeTime } from "@/lib/utils";
import { getNotificationContent } from "@/lib/notifications/templates";

export function Navbar() {
  const { data: session, update } = useSession();
  const { unreadCount, recent, markRead } = useNotifications();
  const [freshName, setFreshName] = useState<string | null>(null);
  const [freshAvatar, setFreshAvatar] = useState<string | null>(null);

  const sessionUser = session?.user as {
    id?: string; personaName?: string; avatarMedium?: string; name?: string; image?: string;
  } | undefined;

  // Auto-refresh profile when JWT has fallback Steam name
  useEffect(() => {
    const name = sessionUser?.personaName ?? sessionUser?.name ?? "";
    if (!name.startsWith("Steam user")) return;
    fetch("/api/auth/refresh-steam-profile", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.personaName) {
          setFreshName(d.data.personaName);
          setFreshAvatar(d.data.avatarUrl ?? null);
          update();
        }
      })
      .catch(() => {});
  }, [sessionUser?.personaName]);

  if (!session?.user) return null;

  const user = {
    ...sessionUser,
    personaName: freshName ?? sessionUser?.personaName,
    avatarMedium: freshAvatar ?? sessionUser?.avatarMedium,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <FamiliesLogo />
          </Link>
          <Link
            href="/catalog"
            className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4" />
            Catálogo
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/10 hover:text-primary transition-colors">
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-card/95 backdrop-blur border-border/60">
              <DropdownMenuLabel className="flex items-center justify-between py-2.5">
                <span className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  Notificações
                </span>
                {unreadCount > 0 && (
                  <Badge className="text-xs h-5">{unreadCount} novas</Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              {recent.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma notificação ainda
                </div>
              ) : (
                <>
                  {recent.slice(0, 10).map((n) => {
                    const payload = n.payload as Record<string, string>;
                    const content = getNotificationContent(
                      n.type as Parameters<typeof getNotificationContent>[0],
                      payload
                    );
                    return (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 focus:bg-primary/10 focus:text-foreground"
                        onClick={() => {
                          markRead(n.id);
                          if (content.link) window.location.href = content.link;
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {!n.readAt && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={`text-sm flex-1 ${!n.readAt ? "font-medium" : "text-muted-foreground"}`}>
                            {content.title}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-3.5 line-clamp-2 leading-relaxed">
                          {content.body}
                        </span>
                        <span className="text-xs text-muted-foreground/60 ml-3.5">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem asChild className="justify-center text-primary text-xs py-2 focus:bg-primary/10 focus:text-primary">
                    <Link href="/notifications">Ver todas as notificações</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-primary/10 hover:text-primary transition-colors">
                <Avatar className="h-7 w-7 ring-1 ring-border">
                  <AvatarImage src={user.avatarMedium ?? user.image ?? ""} alt={user.personaName ?? user.name ?? ""} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {(user.personaName ?? user.name ?? "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">{user.personaName ?? user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur border-border/60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">{user.personaName ?? user.name}</span>
                  <span className="text-xs text-muted-foreground">Steam account</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-foreground">
                <Link href="/notifications" className="cursor-pointer">
                  <Bell className="h-4 w-4 mr-2 text-muted-foreground" />
                  Notificações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-foreground">
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
