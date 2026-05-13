"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { QrCode } from "lucide-react";

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
  pendingPix?: PixData | null;
};

export function CatalogJoinButton({
  familyId,
  familyName,
  entryFeeCents,
  currency,
  initialStatus,
  pendingPix = null,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(pendingPix ?? null);
  const [pixOpen, setPixOpen] = useState(false);

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
        setPixOpen(true);
      } else {
        toast.success("Solicitação enviada! Aguarde aprovação do líder.");
        setStatus("pending");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "rejected") {
    return <span className="text-xs text-destructive font-semibold">Solicitação rejeitada</span>;
  }

  // Pending with unpaid fee — show pay button
  if (status === "pending" && pix) {
    return (
      <>
        <Button
          size="sm"
          onClick={() => setPixOpen(true)}
          className="gap-2"
          style={{
            background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 48%))",
            boxShadow: "0 0 14px hsl(258 82% 60% / 0.35)",
          }}
        >
          <QrCode className="h-4 w-4" />
          Pagar taxa de entrada
        </Button>
        <PixPaymentModal
          open={pixOpen}
          onOpenChange={setPixOpen}
          amountCents={entryFeeCents}
          currency={currency}
          gameName={`Entrada em ${familyName}`}
          pix={pix}
        />
      </>
    );
  }

  // Pending without fee — waiting approval
  if (status === "pending") {
    return <span className="text-xs text-amber-400 font-semibold">Solicitação enviada</span>;
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
          open={pixOpen}
          onOpenChange={setPixOpen}
          amountCents={entryFeeCents}
          currency={currency}
          gameName={`Entrada em ${familyName}`}
          pix={pix}
        />
      )}
    </>
  );
}
