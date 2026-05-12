"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameSearchModal } from "@/components/wishlist/game-search-modal";
import { formatCurrency } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

type VoteData = {
  id: string;
  steamAppId: number;
  status: string;
  closesAt: string;
  tally: { yes: number; no: number; abstain: number };
  myBallot: "yes" | "no" | "abstain" | null;
  steamData: { name: string; headerImage: string } | null;
  openedBy: { personaName: string };
};

export function VotesPanel({ familyId, currency }: { familyId: string; currency: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

  const { data, refetch } = useQuery<{ data: VoteData[] }>({
    queryKey: ["votes", familyId],
    queryFn: () => fetch(`/api/families/${familyId}/votes`).then((r) => r.json()),
    staleTime: 15_000,
  });

  const votes = data?.data ?? [];

  const handleStartVote = async (result: { appId: number }) => {
    setSearchOpen(false);
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`/api/families/${familyId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamAppId: result.appId, closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error?.message ?? "Erro ao criar votação");
      return;
    }
    toast.success("Votação aberta!");
    refetch();
  };

  const castBallot = async (voteId: string, choice: "yes" | "no" | "abstain") => {
    const res = await fetch(`/api/votes/${voteId}/ballot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error?.message ?? "Erro");
      return;
    }
    refetch();
  };

  const activeVotes = votes.filter((v) => v.status === "open");
  const closedVotes = votes.filter((v) => v.status !== "open");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Iniciar Votação
        </Button>
      </div>

      {votes.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma votação ainda. Inicie uma para decidir qual jogo comprar juntos!
        </p>
      )}

      {activeVotes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Votações Abertas</h4>
          {activeVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} onBallot={castBallot} />
          ))}
        </div>
      )}

      {closedVotes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Encerradas</h4>
          {closedVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} onBallot={castBallot} />
          ))}
        </div>
      )}

      <GameSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleStartVote}
        title="Votar em qual jogo comprar"
      />
    </div>
  );
}

function VoteCard({
  vote,
  onBallot,
}: {
  vote: VoteData;
  onBallot: (id: string, choice: "yes" | "no" | "abstain") => void;
}) {
  const total = vote.tally.yes + vote.tally.no + vote.tally.abstain;
  const isOpen = vote.status === "open";
  const closesDate = new Date(vote.closesAt);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
      {vote.steamData?.headerImage && (
        <img
          src={vote.steamData.headerImage}
          alt={vote.steamData.name}
          className="w-16 h-9 object-cover rounded flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {vote.steamData?.name ?? `App #${vote.steamAppId}`}
          </span>
          <Badge variant={isOpen ? "default" : "secondary"} className="text-xs">
            {isOpen ? "Aberta" : "Encerrada"}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>✓ {vote.tally.yes}</span>
          <span>✗ {vote.tally.no}</span>
          <span>— {vote.tally.abstain}</span>
          {isOpen && (
            <span>até {closesDate.toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="flex gap-1 flex-shrink-0">
          {(["yes", "no", "abstain"] as const).map((choice) => (
            <Button
              key={choice}
              size="icon"
              variant={vote.myBallot === choice ? "default" : "outline"}
              className="h-7 w-7"
              onClick={() => onBallot(vote.id, choice)}
              title={choice === "yes" ? "Sim" : choice === "no" ? "Não" : "Abster"}
            >
              {choice === "yes" ? <ThumbsUp className="h-3 w-3" /> :
               choice === "no" ? <ThumbsDown className="h-3 w-3" /> :
               <Minus className="h-3 w-3" />}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
