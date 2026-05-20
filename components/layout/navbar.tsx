"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Settings, Globe, Wallet, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/components/notifications/notification-provider";
import { ReputationBadge } from "@/components/reputation-badge";
import { FamiliesLogo } from "./logo";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import { getNotificationContent } from "@/lib/notifications/templates";
import { useLanguage } from "@/lib/i18n/context";

function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "pt" : "en")}
      title={lang === "en" ? "Mudar para Português" : "Switch to English"}
      className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
    >
      <span className={`text-base leading-none transition-opacity ${lang === "en" ? "opacity-100" : "opacity-30"}`}>🇺🇸</span>
      <span className="text-muted-foreground/40 text-xs mx-0.5">/</span>
      <span className={`text-base leading-none transition-opacity ${lang === "pt" ? "opacity-100" : "opacity-30"}`}>🇧🇷</span>
    </button>
  );
}

export function Navbar() {
  const { data: session, update } = useSession();
  const { unreadCount, recent, markRead } = useNotifications();
  const { t } = useLanguage();
  const pathname = usePathname();
  const isCatalog = pathname?.startsWith("/catalog");
  const isFamily = pathname?.startsWith("/families");
  const [freshName, setFreshName] = useState<string | null>(null);
  const [freshAvatar, setFreshAvatar] = useState<string | null>(null);
  const [creditsCents, setCreditsCents] = useState<number | null>(null);
  const [reputationScore, setReputationScore] = useState<number | null>(null);
  const [myFamilyId, setMyFamilyId] = useState<string | null>(null);

  const sessionUser = session?.user as {
    id?: string; personaName?: string; avatarMedium?: string; name?: string; image?: string;
  } | undefined;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.creditsCents != null) setCreditsCents(d.data.creditsCents);
        if (d.data?.reputationScore != null) setReputationScore(d.data.reputationScore);
        if (d.data?.avatarMedium) setFreshAvatar(d.data.avatarMedium);
        if (d.data?.personaName && !d.data.personaName.startsWith("Steam user")) setFreshName(d.data.personaName);
        if (d.data?.families?.length > 0) setMyFamilyId(d.data.families[0].id);
      })
      .catch(() => {});
  }, []);

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
          update({ personaName: d.data.personaName, avatarUrl: d.data.avatarUrl });
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
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors duration-300"
      style={isCatalog ? {
        borderColor: "hsl(186 90% 48% / 0.35)",
        background: "hsl(186 90% 48% / 0.06)",
      } : {
        borderColor: "hsl(var(--border) / 0.6)",
        background: "hsl(var(--background) / 0.8)",
      }}
    >
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={myFamilyId ? `/families/${myFamilyId}` : "/dashboard"}>
            <FamiliesLogo />
          </Link>
          {myFamilyId && (
            <Link
              href={`/families/${myFamilyId}`}
              className="hidden md:flex items-center gap-1.5 text-sm transition-colors"
              style={isFamily ? {
                color: "hsl(258 82% 68%)",
                fontWeight: 600,
              } : undefined}
            >
              <UsersRound className="h-4 w-4" style={isFamily ? { color: "hsl(258 82% 68%)" } : undefined} />
              <span className={isFamily ? "" : "text-muted-foreground hover:text-foreground"}>
                {t.nav.yourFamily}
              </span>
            </Link>
          )}
          <Link
            href="/catalog"
            className="hidden md:flex items-center gap-1.5 text-sm transition-colors"
            style={isCatalog ? {
              color: "hsl(186 90% 48%)",
              fontWeight: 600,
            } : undefined}
          >
            <Globe className="h-4 w-4" style={isCatalog ? { color: "hsl(186 90% 48%)" } : undefined} />
            <span className={isCatalog ? "" : "text-muted-foreground hover:text-foreground"}>
              {t.nav.catalog}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <LanguageToggle />

          {/* Notification bell */}
          <DropdownMenu modal={false}>
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
                  {t.nav.notifications}
                </span>
                {unreadCount > 0 && (
                  <Badge className="text-xs h-5">{unreadCount} {t.nav.newBadge}</Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              {recent.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t.nav.noNotifications}
                </div>
              ) : (
                <>
                  <div className="max-h-[380px] overflow-y-auto">
                    {recent.map((n) => {
                      const payload = n.payload as Record<string, string>;
                      const content = getNotificationContent(
                        n.type as Parameters<typeof getNotificationContent>[0],
                        payload
                      );
                      return (
                        <DropdownMenuItem
                          key={n.id}
                          className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 focus:bg-primary/10 focus:text-foreground"
                          onMouseEnter={() => { if (!n.readAt) markRead(n.id); }}
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
                  </div>
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem asChild className="justify-center text-primary text-xs py-2 focus:bg-primary/10 focus:text-primary">
                    <Link href="/notifications">{t.nav.viewAll}</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-primary/10 hover:text-primary transition-colors">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={user.avatarMedium || user.image || ""} alt={user.personaName || user.name || ""} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {(user.personaName ?? user.name ?? "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.personaName && !user.personaName.startsWith("Steam user") && (
                  <span className="hidden md:block text-sm font-medium">{user.personaName}</span>
                )}
                {creditsCents !== null && (
                  <span
                    className="hidden md:flex items-center gap-0.5 text-xs font-semibold tabular-nums"
                    style={{ color: creditsCents > 0 ? "hsl(258 82% 72%)" : undefined, opacity: creditsCents > 0 ? 1 : 0.45 }}
                  >
                    <Wallet className="h-3 w-3" />
                    {formatCurrency(creditsCents, "BRL")}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur border-border/60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">{user.personaName ?? user.name}</span>
                  <span className="text-xs text-muted-foreground">{t.nav.steamAccount}</span>
                  {creditsCents != null && (
                    <span
                      className="flex items-center gap-1 text-xs font-medium mt-0.5"
                      style={{ color: creditsCents > 0 ? "hsl(258 82% 72%)" : undefined, opacity: creditsCents > 0 ? 1 : 0.5 }}
                    >
                      <Wallet className="h-3 w-3" />
                      {formatCurrency(creditsCents, "BRL")} {t.nav.credits}
                    </span>
                  )}
                  {reputationScore != null && (
                    <div className="mt-1">
                      <ReputationBadge score={reputationScore} showScore />
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-foreground">
                <Link href="/notifications" className="cursor-pointer">
                  <Bell className="h-4 w-4 mr-2 text-muted-foreground" />
                  {t.nav.notifications}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-foreground">
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                  {t.nav.settings}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.nav.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
