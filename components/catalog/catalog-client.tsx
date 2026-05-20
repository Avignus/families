"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Users, Lock, Unlock, Crown, Search, ChevronLeft, ChevronRight,
  SlidersHorizontal, X, Gamepad2, CheckCircle2, PlusCircle, Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import Link from "next/link";
import { FamilyCoverArt } from "@/components/family-cover-art";
import { useLanguage } from "@/lib/i18n/context";
import { FamilyTierBadge } from "@/components/family-tier-badge";

type LibraryStats = { totalGames: number; ownedGames: number; missingGames: number };

type Family = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  isPublic: boolean;
  entryFeeCents: number;
  spotPricingEnabled: boolean;
  maxMembers: number | null;
  memberCount: number;
  spotsLeft: number | null;
  isFull: boolean;
  chief: { id: string; personaName: string; avatarUrl: string; avatarMedium: string };
  gameCovers: string[];
  myStatus: string | null;
  libraryStats: LibraryStats | null;
  gameNames: string[];
  gameNamesLabel: "missing" | "library";
  familyScore: number;
};

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
};

type Filters = {
  minPrice: string;
  maxPrice: string;
  minGames: string;
  maxGames: string;
  minOwned: string;
  maxOwned: string;
  minMissing: string;
  maxMissing: string;
};

type Props = {
  families: Family[];
  isLoggedIn: boolean;
  total: number;
  page: number;
  pageSize: number;
  query: string;
  filters: Filters;
};

export function CatalogClient({ families, isLoggedIn, total, page, pageSize, query, filters }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [loading, setLoading] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState<{ family: Family; pix: PixData } | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(() => {
    return Object.values(filters).some((v) => v !== "");
  });

  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [minGames, setMinGames] = useState(filters.minGames);
  const [maxGames, setMaxGames] = useState(filters.maxGames);
  const [minOwned, setMinOwned] = useState(filters.minOwned);
  const [maxOwned, setMaxOwned] = useState(filters.maxOwned);
  const [minMissing, setMinMissing] = useState(filters.minMissing);
  const [maxMissing, setMaxMissing] = useState(filters.maxMissing);

  const totalPages = Math.ceil(total / pageSize);

  const activeFilterCount = [
    minPrice || maxPrice,
    minGames || maxGames,
    minOwned || maxOwned,
    minMissing || maxMissing,
  ].filter(Boolean).length;

  const navigate = (q: string, p: number, overrides?: Partial<Filters>) => {
    const f: Filters = { minPrice, maxPrice, minGames, maxGames, minOwned, maxOwned, minMissing, maxMissing, ...overrides };
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    (Object.entries(f) as [keyof Filters, string][]).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(search, 1);
  };

  const clearFilters = () => {
    setMinPrice(""); setMaxPrice("");
    setMinGames(""); setMaxGames("");
    setMinOwned(""); setMaxOwned("");
    setMinMissing(""); setMaxMissing("");
    navigate(search, 1, { minPrice: "", maxPrice: "", minGames: "", maxGames: "", minOwned: "", maxOwned: "", minMissing: "", maxMissing: "" });
  };

  const handleJoin = async (family: Family) => {
    if (!isLoggedIn) { toast.error(t.catalog.loginToJoin); return; }
    setLoading(family.id);
    try {
      const res = await fetch(`/api/families/${family.id}/join-requests`, { method: "POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        toast.error(data.error?.message ?? t.catalog.errorJoining);
        return;
      }
      if (data.data?.pendingPayment && data.data?.pix) {
        setPixModal({ family, pix: data.data.pix });
      } else {
        toast.success(t.catalog.requestSent);
        setLocalStatus((prev) => ({ ...prev, [family.id]: "pending" }));
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Full-page background */}
      <img
        src="/images/catalog-header-image.png"
        alt=""
        className="fixed inset-0 w-full h-full object-cover object-center -z-10"
      />
      <div className="fixed inset-0 -z-10" style={{ background: "hsl(var(--background) / 0.82)" }} />

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {t.catalog.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.catalog.found(total)}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.catalog.searchPlaceholder}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
              {t.catalog.search}
            </Button>
            <Button
              type="button"
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t.catalog.filters}
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold"
                  style={{ background: "hsl(258 82% 60%)", color: "white" }}>
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                {t.catalog.clear}
              </Button>
            )}
          </div>

          {/* Filter panel */}
          {filtersOpen && (
            <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price filter */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.catalog.entryPriceFilter}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t.catalog.min}
                      min="0"
                      step="0.01"
                      className="h-8 text-sm"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                    <Input
                      type="number"
                      placeholder={t.catalog.max}
                      min="0"
                      step="0.01"
                      className="h-8 text-sm"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>

                {/* Total games filter */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Gamepad2 className="h-3.5 w-3.5" /> {t.catalog.gamesInFamily}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t.catalog.min}
                      min="0"
                      className="h-8 text-sm"
                      value={minGames}
                      onChange={(e) => setMinGames(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                    <Input
                      type="number"
                      placeholder={t.catalog.max}
                      min="0"
                      className="h-8 text-sm"
                      value={maxGames}
                      onChange={(e) => setMaxGames(e.target.value)}
                    />
                  </div>
                </div>

                {/* Games I own (intersection) */}
                <div className="space-y-2">
                  <p className={`text-xs font-medium uppercase tracking-wide flex items-center gap-1 ${isLoggedIn ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {t.catalog.gamesYouHave}
                    {!isLoggedIn && <span className="text-[10px] normal-case font-normal">{t.catalog.requiresLogin}</span>}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t.catalog.min}
                      min="0"
                      className="h-8 text-sm"
                      disabled={!isLoggedIn}
                      value={minOwned}
                      onChange={(e) => setMinOwned(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                    <Input
                      type="number"
                      placeholder={t.catalog.max}
                      min="0"
                      className="h-8 text-sm"
                      disabled={!isLoggedIn}
                      value={maxOwned}
                      onChange={(e) => setMaxOwned(e.target.value)}
                    />
                  </div>
                </div>

                {/* Games I don't own (difference) */}
                <div className="space-y-2">
                  <p className={`text-xs font-medium uppercase tracking-wide flex items-center gap-1 ${isLoggedIn ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                    <PlusCircle className="h-3.5 w-3.5 text-primary" />
                    {t.catalog.gamesYouDontHave}
                    {!isLoggedIn && <span className="text-[10px] normal-case font-normal">{t.catalog.requiresLogin}</span>}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t.catalog.min}
                      min="0"
                      className="h-8 text-sm"
                      disabled={!isLoggedIn}
                      value={minMissing}
                      onChange={(e) => setMinMissing(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                    <Input
                      type="number"
                      placeholder={t.catalog.max}
                      min="0"
                      className="h-8 text-sm"
                      disabled={!isLoggedIn}
                      value={maxMissing}
                      onChange={(e) => setMaxMissing(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isPending}>
                  {t.catalog.applyFilters}
                </Button>
              </div>
            </div>
          )}
        </form>

        {families.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {t.catalog.noFamilies(query)}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map((family) => (
              <FamilyCard
                key={family.id}
                family={family}
                loading={loading === family.id}
                myStatus={localStatus[family.id] ?? family.myStatus}
                isLoggedIn={isLoggedIn}
                onJoin={handleJoin}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => navigate(search, page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => navigate(search, page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {pixModal && (
        <PixPaymentModal
          open
          onOpenChange={(v) => { if (!v) setPixModal(null); }}
          amountCents={pixModal.family.entryFeeCents}
          currency={pixModal.family.currency}
          gameName={t.catalogJoinBtn.entryInto(pixModal.family.name)}
          pix={pixModal.pix}
        />
      )}
    </div>
  );
}

function FamilyCard({
  family, loading, myStatus, isLoggedIn, onJoin,
}: {
  family: Family;
  loading: boolean;
  myStatus: string | null;
  isLoggedIn: boolean;
  onJoin: (f: Family) => void;
}) {
  const { t } = useLanguage();
  const hasFee = family.entryFeeCents > 0;
  const stats = family.libraryStats;

  const statusLabel = () => {
    if (myStatus === "active") return { text: t.catalog.member, color: "text-emerald-400" };
    if (myStatus === "pending") return { text: t.catalog.requestPending, color: "text-amber-400" };
    if (myStatus === "rejected") return { text: t.catalog.rejected, color: "text-destructive" };
    return null;
  };

  const status = statusLabel();

  return (
    <div className="relative rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col hover:border-primary/30 transition-colors">
      {/* Full-card link overlay */}
      <Link href={`/catalog/${family.id}`} className="absolute inset-0 z-0" aria-label={family.name} />

      <div className="h-20 flex overflow-hidden bg-secondary pointer-events-none">
        {family.gameCovers.length > 0 ? (
          family.gameCovers.map((src, i) => (
            <img key={i} src={src} alt="" className="h-full object-cover flex-1 min-w-0" />
          ))
        ) : (
          <FamilyCoverArt familyId={family.id} />
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm truncate" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {family.name}
            </h2>
            <FamilyTierBadge score={family.familyScore} />
          </div>
          {family.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{family.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src={family.chief.avatarMedium || family.chief.avatarUrl}
            alt=""
            className="h-4 w-4 rounded-full"
          />
          <span className="truncate max-w-[100px]">{family.chief.personaName}</span>
          <Crown className="h-3 w-3 text-amber-400 flex-shrink-0" />
        </div>

        {/* Library stats */}
        {stats !== null && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Gamepad2 className="h-3 w-3" />
              {stats.totalGames} jogos
            </span>
            {isLoggedIn && (
              <>
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" />
                  {stats.ownedGames} seus
                </span>
                <span className="flex items-center gap-1 text-primary">
                  <PlusCircle className="h-3 w-3" />
                  {stats.missingGames} novos
                </span>
              </>
            )}
          </div>
        )}

        {/* Game name chips */}
        {(family.gameNames ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {family.gameNamesLabel === "missing" ? (
              <span className="text-[10px] font-medium text-primary/80 self-center shrink-0">
                você ganharia:
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground/60 self-center shrink-0">
                possui:
              </span>
            )}
            {(family.gameNames ?? []).slice(0, 3).map((name) => (
              <span
                key={name}
                className={`text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[110px] ${
                  family.gameNamesLabel === "missing"
                    ? "bg-primary/10 text-primary/90"
                    : "bg-muted/50 text-muted-foreground"
                }`}
                title={name}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {family.memberCount}
              {family.maxMembers ? `/${family.maxMembers}` : ""} membros
            </span>
          </div>
          {family.spotPricingEnabled ? (
            <span className="flex items-center gap-1 text-primary font-semibold text-xs">
              <Zap className="h-3 w-3" /> Spot
            </span>
          ) : hasFee ? (
            <span className="text-primary font-semibold">
              {formatCurrency(family.entryFeeCents, family.currency)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <Unlock className="h-3 w-3" /> Gratuito
            </span>
          )}
        </div>

        <div className="mt-auto relative z-10">
          {status ? (
            <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
          ) : !family.isPublic ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {t.catalog.privateFamily}
            </div>
          ) : family.isFull ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {t.catalog.noSlots}
            </div>
          ) : (
            <button
              onClick={() => onJoin(family)}
              disabled={loading}
              className="w-full h-8 rounded-md text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
            >
              {loading
                ? "..."
                : family.spotPricingEnabled
                ? t.catalog.joinSpot
                : hasFee
                ? t.catalogJoinBtn.join(formatCurrency(family.entryFeeCents, family.currency))
                : t.catalog.joinRequest}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
