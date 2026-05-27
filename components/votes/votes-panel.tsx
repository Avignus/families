"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameSearchModal } from "@/components/wishlist/game-search-modal";
import { ThumbsUp, ThumbsDown, Minus, Plus, CalendarClock, Vote } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

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
  const { t } = useLanguage();
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
      toast.error(data.error?.message ?? t.votes.error);
      return;
    }
    toast.success(t.votes.success);
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
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> {t.votes.start}
        </Button>
      </div>

      {votes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Vote className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.votes.noVotes}</p>
        </div>
      )}

      {activeVotes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.votes.openSection}
          </p>
          {activeVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} onBallot={castBallot} />
          ))}
        </div>
      )}

      {closedVotes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.votes.closedSection}
          </p>
          {closedVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} onBallot={castBallot} />
          ))}
        </div>
      )}

      <GameSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleStartVote}
        title={t.votes.searchTitle}
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
  const { t } = useLanguage();
  const isOpen = vote.status === "open";
  const closesDate = new Date(vote.closesAt);
  const total = vote.tally.yes + vote.tally.no + vote.tally.abstain;

  const daysLeft = Math.ceil((closesDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const urgent = isOpen && daysLeft <= 2;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden transition-colors ${
      isOpen ? "border-border hover:border-border/80" : "border-border/40 opacity-70"
    }`}>
      <div className="flex items-stretch gap-0">
        {/* Game thumbnail */}
        {vote.steamData?.headerImage ? (
          <img
            src={vote.steamData.headerImage}
            alt={vote.steamData.name}
            className="w-24 h-auto object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-24 flex-shrink-0 bg-secondary" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {vote.steamData?.name ?? `App #${vote.steamAppId}`}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {isOpen ? t.votes.open : t.votes.closed}
                </Badge>
                {isOpen && (
                  <span className={`flex items-center gap-1 text-[11px] ${urgent ? "text-amber-400" : "text-muted-foreground"}`}>
                    <CalendarClock className="h-3 w-3" />
                    {t.votes.until(closesDate.toLocaleDateString(t.dateLocale))}
                  </span>
                )}
              </div>
            </div>

            {/* Vote buttons */}
            {isOpen && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onBallot(vote.id, "yes")}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    vote.myBallot === "yes"
                      ? "bg-emerald-500 text-white"
                      : "bg-secondary hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400"
                  }`}
                  title={t.votes.yes}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onBallot(vote.id, "no")}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    vote.myBallot === "no"
                      ? "bg-rose-500 text-white"
                      : "bg-secondary hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400"
                  }`}
                  title={t.votes.no}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onBallot(vote.id, "abstain")}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    vote.myBallot === "abstain"
                      ? "bg-secondary border border-border text-foreground"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                  }`}
                  title={t.votes.abstain}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tally + progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ThumbsUp className="h-3 w-3" /> {vote.tally.yes}
              </span>
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <ThumbsDown className="h-3 w-3" /> {vote.tally.no}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-3 w-3" /> {vote.tally.abstain}
              </span>
            </div>
            {total > 0 && (
              <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary gap-px">
                {vote.tally.yes > 0 && (
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(vote.tally.yes / total) * 100}%` }}
                  />
                )}
                {vote.tally.no > 0 && (
                  <div
                    className="bg-rose-500 transition-all"
                    style={{ width: `${(vote.tally.no / total) * 100}%` }}
                  />
                )}
                {vote.tally.abstain > 0 && (
                  <div
                    className="bg-muted-foreground/30 transition-all"
                    style={{ width: `${(vote.tally.abstain / total) * 100}%` }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
