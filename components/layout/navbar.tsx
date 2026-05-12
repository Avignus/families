"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
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

export function Navbar() {
  const { data: session } = useSession();
  const { unreadCount, recent, markRead } = useNotifications();

  if (!session?.user) return null;

  const user = session.user as {
    id?: string; personaName?: string; avatarMedium?: string; name?: string; image?: string;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <FamiliesLogo />
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-secondary/80">
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
                    return (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 focus:bg-secondary/60"
                        onClick={() => markRead(n.id)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {!n.readAt && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={`text-sm flex-1 ${!n.readAt ? "font-medium" : "text-muted-foreground"}`}>
                            {payload.gameName ?? payload.familyName ?? n.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-3.5">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem asChild className="justify-center text-primary text-xs py-2">
                    <Link href="/notifications">Ver todas as notificações</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-secondary/80">
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
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer">
                  <Bell className="h-4 w-4 mr-2 text-muted-foreground" />
                  Notificações
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
