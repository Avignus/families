"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { Users, Lock, Unlock, Crown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import Link from "next/link";

type Family = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  isPublic: boolean;
  entryFeeCents: number;
  maxMembers: number | null;
  memberCount: number;
  spotsLeft: number | null;
  isFull: boolean;
  chief: { id: string; personaName: string; avatarUrl: string; avatarMedium: string };
  gameCovers: string[];
  myStatus: string | null;
};

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
};

type Props = {
  families: Family[];
  isLoggedIn: boolean;
  total: number;
  page: number;
  pageSize: number;
  query: string;
};

export function CatalogClient({ families, isLoggedIn, total, page, pageSize, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [loading, setLoading] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState<{ family: Family; pix: PixData } | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const totalPages = Math.ceil(total / pageSize);

  const navigate = (q: string, p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q); else params.delete("q");
    if (p > 1) params.set("page", String(p)); else params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(search, 1);
  };

  const handleJoin = async (family: Family) => {
    if (!isLoggedIn) { toast.error("Faça login para entrar em uma família"); return; }
    setLoading(family.id);
    try {
      const res = await fetch(`/api/families/${family.id}/join-requests`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao solicitar entrada");
        return;
      }
      if (data.data?.pendingPayment && data.data?.pix) {
        setPixModal({ family, pix: data.data.pix });
      } else {
        toast.success("Solicitação enviada! Aguarde aprovação do líder.");
        setLocalStatus((prev) => ({ ...prev, [family.id]: "pending" }));
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Catálogo de Famílias
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "família" : "famílias"} encontradas
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative max-w-sm flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
            Buscar
          </Button>
        </form>

        {families.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            Nenhuma família encontrada{query ? ` para "${query}"` : ""}.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map((family) => (
              <FamilyCard
                key={family.id}
                family={family}
                loading={loading === family.id}
                myStatus={localStatus[family.id] ?? family.myStatus}
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
          gameName={`Entrada em ${pixModal.family.name}`}
          pix={pixModal.pix}
        />
      )}
    </div>
  );
}

function FamilyCard({
  family, loading, myStatus, onJoin,
}: {
  family: Family;
  loading: boolean;
  myStatus: string | null;
  onJoin: (f: Family) => void;
}) {
  const hasFee = family.entryFeeCents > 0;

  const statusLabel = () => {
    if (myStatus === "active") return { text: "Membro", color: "text-emerald-400" };
    if (myStatus === "pending") return { text: "Solicitação enviada", color: "text-amber-400" };
    if (myStatus === "rejected") return { text: "Rejeitado", color: "text-destructive" };
    return null;
  };

  const status = statusLabel();

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col hover:border-primary/30 transition-colors">
      <Link href={`/catalog/${family.id}`} className="block">
        <div className="h-20 flex overflow-hidden bg-secondary">
          {family.gameCovers.length > 0 ? (
            family.gameCovers.map((src, i) => (
              <img key={i} src={src} alt="" className="h-full object-cover flex-1 min-w-0" />
            ))
          ) : (
            <div className="w-full flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h2 className="font-semibold text-sm truncate" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {family.name}
          </h2>
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

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {family.memberCount}
              {family.maxMembers ? `/${family.maxMembers}` : ""} membros
            </span>
          </div>
          {hasFee ? (
            <span className="text-primary font-semibold">
              {formatCurrency(family.entryFeeCents, family.currency)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <Unlock className="h-3 w-3" /> Gratuito
            </span>
          )}
        </div>

        <div className="mt-auto">
          {status ? (
            <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
          ) : !family.isPublic ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Família privada
            </div>
          ) : family.isFull ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Sem vagas
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
                : hasFee
                ? `Entrar · ${formatCurrency(family.entryFeeCents, family.currency)}`
                : "Pedir entrada"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
