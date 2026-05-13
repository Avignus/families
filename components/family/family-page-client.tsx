"use client";

import { useState } from "react";
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
import { SteamLibraryPanel } from "@/components/family/steam-library-panel";
import { Plus, ChevronDown, ChevronUp, Settings, Copy, LogIn, Gamepad2 } from "lucide-react";
import { MonthlyBudgetForm } from "@/components/family/monthly-budget-form";
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

type WishlistItem = {
  id: string;
  steamAppId: number;
  targetPriceCents: number;
  currency: string;
  status: string;
  ownerUserId: string | null;
  owner: Member | null;
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
};

type FamilyData = {
  id: string;
  name: string;
  currency: string;
  chiefId: string;
  isChief: boolean;
  currentUserId: string;
  monthlyBudgetCents: number;
  memberships: Array<{ user: Member }>;
  wishlistItems: WishlistItem[];
};

export function FamilyPageClient({ familyId }: { familyId: string }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const { data, isLoading, error, refetch } = useQuery<{ data: FamilyData }, { status: number; code: string }>({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}`);
      const json = await r.json();
      if (!r.ok) {
        const e = Object.assign(new Error(json.error?.message ?? "Error"), {
          status: r.status,
          code: json.error?.code ?? "UNKNOWN",
        });
        throw e;
      }
      return json;
    },
    staleTime: 10_000,
    retry: false,
  });

  const family = data?.data;

  const [addGameOpen, setAddGameOpen] = useState(false);
  const [votesExpanded, setVotesExpanded] = useState(false);
  const [steamExpanded, setSteamExpanded] = useState(false);

  const memberColors = new Map(
    family?.memberships.map((m, i) => [m.user.id, getMemberColor(i)]) ?? []
  );

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

  if (error) {
    if ((error as { status?: number }).status === 403) return <JoinRequestScreen familyId={familyId} />;
    return (
      <div className="container py-8 text-center text-muted-foreground">
        Família não encontrada.
      </div>
    );
  }

  if (!family) return null;

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
              <CardTitle className="text-2xl">{family.name}</CardTitle>
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
              {family.memberships.map(({ user }) => {
                const color = memberColors.get(user.id)!;
                return (
                  <div key={user.id} className="flex flex-col items-center gap-1.5">
                    <Avatar className="h-12 w-12" style={{ boxShadow: `0 0 0 2px ${color}` }}>
                      <AvatarImage src={user.avatarMedium} alt={user.personaName} />
                      <AvatarFallback style={{ backgroundColor: color }}>
                        {user.personaName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs max-w-[60px] truncate" style={{ color }}>
                      {user.personaName}
                    </span>
                    {user.id === family.chiefId && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">Chefe</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Shared family wishlist */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Lista de Desejos da Família</h3>
              <Button size="sm" variant="outline" onClick={() => setAddGameOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Jogo
              </Button>
            </div>

            <MonthlyBudgetForm
              familyId={familyId}
              currency={family.currency}
              initialBudgetCents={family.monthlyBudgetCents}
            />

            {family.wishlistItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum jogo na lista ainda. Adicione o primeiro!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {family.wishlistItems.map((item) => (
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

          {/* Steam — games & unified wishlist */}
          <Separator />
          <div>
            <button
              onClick={() => setSteamExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            >
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              <span>Jogos Steam da Família</span>
              {steamExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {steamExpanded && (
              <div className="mt-4">
                <SteamLibraryPanel
                  familyId={familyId}
                  currentUserId={userId}
                  memberColors={memberColors}
                  sharedWishlistAppIds={new Set(family.wishlistItems.map((i) => i.steamAppId))}
                />
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

function JoinRequestScreen({ familyId }: { familyId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.code === "ALREADY_PENDING") {
          toast.info("Você já tem uma solicitação pendente para esta família.");
          setSent(true);
        } else {
          toast.error(json.error?.message ?? "Erro ao solicitar entrada");
        }
        return;
      }
      toast.success("Solicitação enviada! Aguarde a aprovação do chefe.");
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-16 flex justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Você não é membro desta família</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para ver o conteúdo desta família, envie uma solicitação de entrada ao chefe.
          </p>
          <p className="text-xs text-muted-foreground font-mono">{familyId}</p>
          {sent ? (
            <p className="text-sm font-medium text-green-500">Solicitação enviada! Aguarde a aprovação.</p>
          ) : (
            <Button onClick={handleRequest} disabled={loading} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Enviando..." : "Solicitar Entrada"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
