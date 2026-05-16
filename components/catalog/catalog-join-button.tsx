"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";

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
  spotPriceCents?: number | null;
};

export function CatalogJoinButton({
  familyId,
  familyName,
  entryFeeCents,
  currency,
  initialStatus,
  pendingPix = null,
  spotPriceCents = null,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(pendingPix ?? null);
  const [pixOpen, setPixOpen] = useState(false);

  const [resolvedSpotPrice, setResolvedSpotPrice] = useState<number | null>(spotPriceCents ?? null);
  const displayFeeCents = resolvedSpotPrice !== null ? resolvedSpotPrice : entryFeeCents;

  const handleJoin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.catalogJoinBtn.error);
        return;
      }
      if (data.data?.spotPriceCents !== undefined) {
        setResolvedSpotPrice(data.data.spotPriceCents);
      }
      if (data.data?.pendingPayment && data.data?.pix) {
        setPix(data.data.pix);
        setPixOpen(true);
      } else {
        toast.success(t.catalogJoinBtn.success);
        setStatus("pending");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "rejected") {
    return <span className="text-xs text-destructive font-semibold">{t.catalogJoinBtn.rejected}</span>;
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
          {t.catalogJoinBtn.payFee}
        </Button>
        <PixPaymentModal
          open={pixOpen}
          onOpenChange={setPixOpen}
          amountCents={displayFeeCents}
          currency={currency}
          gameName={t.catalogJoinBtn.entryInto(familyName)}
          pix={pix}
          pollUrl={`/api/families/${familyId}/entry-status`}
          onConfirmed={() => router.push(`/families/${familyId}`)}
        />
      </>
    );
  }

  // Pending without fee — waiting approval
  if (status === "pending") {
    return <span className="text-xs text-amber-400 font-semibold">{t.catalogJoinBtn.requestSent}</span>;
  }

  return (
    <>
      <Button size="sm" onClick={handleJoin} disabled={loading}>
        {loading
          ? "..."
          : displayFeeCents > 0
          ? t.catalogJoinBtn.join(formatCurrency(displayFeeCents, currency))
          : t.catalogJoinBtn.request}
      </Button>
      {pix && (
        <PixPaymentModal
          open={pixOpen}
          onOpenChange={setPixOpen}
          amountCents={displayFeeCents}
          currency={currency}
          gameName={t.catalogJoinBtn.entryInto(familyName)}
          pix={pix}
          pollUrl={`/api/families/${familyId}/entry-status`}
          onConfirmed={() => router.push(`/families/${familyId}`)}
        />
      )}
    </>
  );
}
