import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { notFound } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Crown, Users, Lock, Unlock, Gamepad2, ShoppingCart, TrendingUp, Library, Trophy } from "lucide-react";
import Link from "next/link";
import { CatalogJoinButton } from "@/components/catalog/catalog-join-button";
import { CatalogWishlistItem } from "@/components/catalog/catalog-wishlist-item";
import { CatalogSteamPanel } from "@/components/catalog/catalog-steam-panel";

export const dynamic = "force-dynamic";

export default async function CatalogFamilyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      chief: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      memberships: {
        where: { status: "active" },
        include: { user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } } },
      },
      wishlistItems: {
        where: { status: { not: "cancelled" } },
        include: {
          pledges: {
            where: { status: "active" },
            select: { amountCents: true, paidAt: true, pledgerUserId: true },
          },
          owner: { select: { personaName: true, avatarMedium: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!family) notFound();

  const myMembership = currentUserId
    ? await prisma.familyMembership.findUnique({
        where: { userId_familyId: { userId: currentUserId, familyId: params.id } },
        select: { status: true },
      })
    : null;

  const isMember = myMembership?.status === "active";
  const memberCount = family.memberships.length;
  const isFull = family.maxMembers ? memberCount >= family.maxMembers : false;

  // Split wishlist by status
  const openItems = family.wishlistItems.filter((i) => i.status === "open" || i.status === "funded");
  const purchasedItems = family.wishlistItems.filter((i) => i.status === "purchased");

  // Stats
  const totalPaidCents = family.wishlistItems
    .flatMap((i) => i.pledges)
    .filter((p) => p.paidAt)
    .reduce((s, p) => s + p.amountCents, 0);

  // Per-member contribution totals (top contributors)
  const contributionMap = new Map<string, number>();
  for (const item of family.wishlistItems) {
    for (const pledge of item.pledges) {
      if (pledge.paidAt) {
        contributionMap.set(
          pledge.pledgerUserId,
          (contributionMap.get(pledge.pledgerUserId) ?? 0) + pledge.amountCents
        );
      }
    }
  }
  const topContributors = family.memberships
    .map((m) => ({ user: m.user, totalCents: contributionMap.get(m.user.id) ?? 0 }))
    .filter((c) => c.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);

  // Enrich open wishlist with Steam data
  const wishlistWithSteam = await Promise.all(
    openItems.map(async (item) => {
      const steam = await getAppDetails(item.steamAppId);
      const pledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
      return {
        ...item,
        steam,
        pledgedCents: pledged,
        percent: item.targetPriceCents > 0
          ? Math.round((pledged / item.targetPriceCents) * 100)
          : 0,
      };
    })
  );

  // Enrich purchased items
  const purchasedWithSteam = await Promise.all(
    purchasedItems.slice(0, 6).map(async (item) => {
      const steam = await getAppDetails(item.steamAppId);
      return { ...item, steam };
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Catálogo
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {family.name}
            </h1>
            {family.description && (
              <p className="text-sm text-muted-foreground max-w-md">{family.description}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {family.isPublic && !isFull ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs">
                  <Unlock className="h-3.5 w-3.5" /> Aberta
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Lock className="h-3.5 w-3.5" /> {isFull ? "Sem vagas" : "Privada"}
                </span>
              )}
              {family.entryFeeCents > 0 && (
                <Badge variant="outline" className="text-primary border-primary/40">
                  {formatCurrency(family.entryFeeCents, family.currency)}
                </Badge>
              )}
            </div>
            {currentUserId && !isMember && family.isPublic && !isFull && (
              <CatalogJoinButton
                familyId={params.id}
                familyName={family.name}
                entryFeeCents={family.entryFeeCents}
                currency={family.currency}
                initialStatus={myMembership?.status ?? null}
              />
            )}
          </div>
        </div>

        {/* Members strip */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex -space-x-2">
            {family.memberships.slice(0, 8).map(({ user }) => (
              <Avatar key={user.id} className="h-8 w-8 ring-2 ring-background">
                <AvatarImage src={user.avatarMedium} />
                <AvatarFallback className="text-xs">{user.personaName[0]}</AvatarFallback>
              </Avatar>
            ))}
            {memberCount > 8 && (
              <div className="h-8 w-8 rounded-full ring-2 ring-background bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                +{memberCount - 8}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {memberCount}{family.maxMembers ? `/${family.maxMembers}` : ""} membros
            <span className="text-muted-foreground/40">·</span>
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            {family.chief.personaName}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total arrecadado"
          value={totalPaidCents > 0 ? formatCurrency(totalPaidCents, family.currency) : "—"}
          highlight
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Jogos comprados"
          value={purchasedItems.length > 0 ? String(purchasedItems.length) : "—"}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Membros ativos"
          value={String(memberCount)}
        />
      </div>

      {/* Top contributors */}
      {topContributors.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-400" />
            Top Contribuidores
          </h2>
          <div className="flex flex-wrap gap-3">
            {topContributors.map(({ user, totalCents }, i) => (
              <div key={user.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}.</span>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatarMedium} />
                  <AvatarFallback className="text-[10px]">{user.personaName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{user.personaName}</span>
                <span className="text-xs text-primary font-semibold">{formatCurrency(totalCents, family.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently purchased */}
      {purchasedWithSteam.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-400" />
            Jogos já comprados pela família
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {purchasedWithSteam.map((item) => (
              <div key={item.id} className="flex-shrink-0 w-40 rounded-lg overflow-hidden border border-border/50 bg-card">
                {item.steam?.headerImage ? (
                  <img src={item.steam.headerImage} alt={item.steam.name} className="w-full h-[54px] object-cover" />
                ) : (
                  <div className="w-full h-[54px] bg-secondary" />
                )}
                <div className="p-2">
                  <p className="text-[11px] font-medium leading-tight line-clamp-2">
                    {item.steam?.name ?? `App #${item.steamAppId}`}
                  </p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-emerald-400 font-semibold">
                    <ShoppingCart className="h-2.5 w-2.5" /> Comprado
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open wishlist */}
      <div className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
          Lista de Desejos ({wishlistWithSteam.length})
        </h2>
        {wishlistWithSteam.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum jogo na lista no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlistWithSteam.map((item) => (
              <CatalogWishlistItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Steam library */}
      <div className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Library className="h-4 w-4 text-muted-foreground" />
          Jogos Steam da Família
        </h2>
        <CatalogSteamPanel
          familyId={params.id}
          members={family.memberships.map((m) => ({ id: m.user.id }))}
          wishlistAppIds={family.wishlistItems.map((i) => i.steamAppId)}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${highlight ? "border-primary/30 bg-primary/5" : "border-border/50 bg-card"}`}>
      <div className={`flex items-center gap-1.5 text-xs ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-xl font-bold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
