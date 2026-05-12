"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bell, Home, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/components/notifications/notification-provider";

export function Navbar() {
  const { data: session } = useSession();
  const { unreadCount, recent, markRead } = useNotifications();

  if (!session?.user) return null;

  const user = session.user as {
    id?: string; personaName?: string; avatarMedium?: string; name?: string; image?: string;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary">
            <Users className="h-5 w-5" />
            <span>Families</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="h-4 w-4" /> Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notificações</span>
                <Link href="/notifications" className="text-xs text-primary hover:underline">Ver todas</Link>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recent.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                recent.slice(0, 10).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-0.5 cursor-pointer"
                    onClick={() => markRead(n.id)}
                  >
                    <span className={`text-sm ${!n.readAt ? "font-medium" : "text-muted-foreground"}`}>
                      {(n.payload as { gameName?: string; personaName?: string; familyName?: string }).gameName
                        ?? (n.payload as { personaName?: string }).personaName
                        ?? n.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatarMedium ?? user.image ?? ""} alt={user.personaName ?? user.name ?? ""} />
                  <AvatarFallback>{(user.personaName ?? user.name ?? "?")[0]}</AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm">{user.personaName ?? user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.personaName ?? user.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/notifications">Notificações</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive">
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
