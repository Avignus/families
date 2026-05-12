"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WishlistItemCard } from "@/components/wishlist/wishlist-item-card";
import { GameSearchModal } from "@/components/wishlist/game-search-modal";
import { VotesPanel } from "@/components/votes/votes-panel";
import { Plus, ChevronDown, ChevronUp, Settings, Copy } from "lucide-react";
import { getMemberColor, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

type Member = {
  id: string;
  personaName: string;
  avatarUrl: string;
  avatarMedium: string;
  steamId: string;
};

type FamilyData = {
  id: string;
  name: string;
  currency: string;
  chiefId: string;
  isChief: boolean;
  currentUserId: string;
  memberships: Array<{ user: Member }>;
  wishlistItems: Array<{
    id: string;
    steamAppId: number;
    targetPriceCents: number;
    currency: string;
    status: string;
    ownerUserId: string | null;
    totalPledgedCents: number;
    percentFunded: number;
    steamData: { appId: number; name: string; headerImage: string; priceCents: number; currency: string; isFree: boolean } | null;
    pledges: Array<{
      id: string;
      pledgerUserId: string;
      amountCents: number;
      percent: number;
      pledger: Member;
    }>;
  }>;
};

export function FamilyPageClient({ familyId }: { familyId: string }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const { data, isLoading, refetch } = useQuery<{ data: FamilyData }>({
    queryKey: ["family", familyId],
    queryFn: () => fetch(`/api/families/${familyId}`).then((r) => r.json()),
    staleTime: 10_000,
  });

  const family = data?.data;

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [votesExpanded, setVotesExpanded] = useState(false);

  const selectedMember = family?.memberships.find((m) => m.user.id === selectedMemberId)?.user
    ?? family?.memberships.find((m) => m.user.id === userId)?.user;
  const effectiveSelected = selectedMember ?? family?.memberships[0]?.user;

  const memberColors = new Map(
    family?.memberships.map((m, i) => [m.user.id, getMemberColor(i)]) ?? []
  );

  const wishlistForSelected = family?.wishlistItems.filter(
    (item) => item.ownerUserId === effectiveSelected?.id
  ) ?? [];

  const handleAddGame = async (result: { appId: number; name: string }) => {
    setAddGameOpen(false);
    const res = await fetch(`/api/families/${familyId}/wishlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamAppId: result.appId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error?.code === "GAME_ALREADY_IN_FAMILY") {
        toast.error(data.error.message);
      } else {
        toast.error(data.error?.message ?? "Erro ao adicionar jogo");
      }
      return;
    }
    toast.success(`${result.name} adicionado à lista!`);
    refetch();
  };

  const copyId = () => {
    navigator.clipboard.writeText(familyId);
    toast.success("ID copiado!");
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-secondary rounded" />
          <div className="h-4 w-48 bg-secondary rounded" />
          <div className="flex gap-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 w-14 rounded-full bg-secondary" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[1, 2].map((i) => <div key={i} className="h-48 bg-secondary rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="container py-8 text-center text-muted-foreground">
        Família não encontrada ou você não tem acesso.
      </div>
    );
  }

  // Settlement summary
  const settlement: Record<string, Record<string, number>> = {};
  for (const item of family.wishlistItems) {
    if (!item.ownerUserId) continue;
    for (const pledge of item.pledges) {
      if (item.status === "open" || item.status === "funded") {
        if (!settlement[pledge.pledgerUserId]) settlement[pledge.pledgerUserId] = {};
        settlement[pledge.pledgerUserId][item.ownerUserId] =
          (settlement[pledge.pledgerUserId][item.ownerUserId] ?? 0) + pledge.amountCents;
      }
    }
  }

  const memberMap = new Map(family.memberships.map((m) => [m.user.id, m.user]));

  return (
    <div className="container py-8 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-2xl">Família {family.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">{familyId}</span>
                <button onClick={copyId} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            {family.isChief && (
              <Link href={`/families/${familyId}/admin`}>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4 mr-1" /> Administrar
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Members strip */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Membros</h3>
            <div className="flex flex-wrap gap-4">
              {family.memberships.map(({ user }, i) => {
                const color = memberColors.get(user.id)!;
                const isSelected = effectiveSelected?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedMemberId(user.id)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className={`rounded-full p-0.5 transition-all ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-card" : "ring-0"
                      }`}
                      style={isSelected ? { outlineColor: color } : {}}
                    >
                      <Avatar
                        className="h-12 w-12 transition-transform group-hover:scale-105"
                        style={isSelected ? { boxShadow: `0 0 0 2px ${color}` } : {}}
                      >
                        <AvatarImage src={user.avatarMedium} alt={user.personaName} />
                        <AvatarFallback style={{ backgroundColor: color }}>
                          {user.personaName[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span
                      className="text-xs max-w-[60px] truncate"
                      style={isSelected ? { color } : {}}
                    >
                      {user.personaName}
                    </span>
                    {user.id === family.chiefId && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">Chefe</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Selected member's wishlist */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                Lista de {effectiveSelected?.personaName}
              </h3>
              {effectiveSelected?.id === userId && (
                <Button size="sm" variant="outline" onClick={() => setAddGameOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Jogo
                </Button>
              )}
            </div>

            {wishlistForSelected.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {effectiveSelected?.id === userId
                  ? "Sua lista está vazia. Adicione jogos!"
                  : `${effectiveSelected?.personaName} não tem jogos na lista ainda.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wishlistForSelected.map((item) => (
                  <WishlistItemCard
                    key={item.id}
                    item={item}
                    currentUserId={userId}
                    memberColors={memberColors}
                    onRefresh={() => refetch()}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Settlement table */}
          {Object.keys(settlement).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Resumo de Contribuições</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(settlement).map(([pledgerId, owed]) =>
                    Object.entries(owed).map(([ownerId, cents]) => {
                      const pledger = memberMap.get(pledgerId);
                      const owner = memberMap.get(ownerId);
                      if (!pledger || !owner) return null;
                      return (
                        <div key={`${pledgerId}-${ownerId}`} className="flex justify-between text-muted-foreground">
                          <span>
                            <span style={{ color: memberColors.get(pledgerId) }}>{pledger.personaName}</span>
                            {" deve "}
                            <span style={{ color: memberColors.get(ownerId) }}>{owner.personaName}</span>
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(cents, family.currency)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Este app registra apenas quem deve o quê. O pagamento real é combinado entre os membros.
                </p>
              </div>
            </>
          )}

          {/* Votes panel */}
          <Separator />
          <div>
            <button
              onClick={() => setVotesExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            >
              <span>Votações</span>
              {votesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {votesExpanded && (
              <div className="mt-4">
                <VotesPanel familyId={familyId} currency={family.currency} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GameSearchModal
        open={addGameOpen}
        onOpenChange={setAddGameOpen}
        onSelect={handleAddGame}
        title="Adicionar à Lista de Desejos"
      />
    </div>
  );
}
