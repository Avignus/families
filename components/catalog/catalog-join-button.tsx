"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
};

type Props = {
  familyId: string;
  familyName: string;
  entryFeeCents: number;
  currency: string;
  initialStatus: string | null;
};

export function CatalogJoinButton({ familyId, familyName, entryFeeCents, currency, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(null);

  const handleJoin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao solicitar entrada");
        return;
      }
      if (data.data?.pendingPayment && data.data?.pix) {
        setPix(data.data.pix);
      } else {
        toast.success("Solicitação enviada! Aguarde aprovação do líder.");
        setStatus("pending");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "pending") {
    return <span className="text-xs text-amber-400 font-semibold">Solicitação enviada</span>;
  }
  if (status === "rejected") {
    return <span className="text-xs text-destructive font-semibold">Solicitação rejeitada</span>;
  }

  return (
    <>
      <Button size="sm" onClick={handleJoin} disabled={loading}>
        {loading
          ? "..."
          : entryFeeCents > 0
          ? `Entrar · ${formatCurrency(entryFeeCents, currency)}`
          : "Pedir entrada"}
      </Button>
      {pix && (
        <PixPaymentModal
          open
          onOpenChange={(v) => { if (!v) setPix(null); }}
          amountCents={entryFeeCents}
          currency={currency}
          gameName={`Entrada em ${familyName}`}
          pix={pix}
        />
      )}
    </>
  );
}
