"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { QrCode, Zap } from "lucide-react";
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
  large?: boolean;
};

export function CatalogJoinButton({
  familyId,
  familyName,
  entryFeeCents,
  currency,
  initialStatus,
  pendingPix = null,
  spotPriceCents = null,
  large = false,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(pendingPix ?? null);
  const [pixOpen, setPixOpen] = useState(false);

  const [resolvedSpotPrice, setResolvedSpotPrice] = useState<number | null>(spotPriceCents ?? null);
  const [resolvedFeeCharged, setResolvedFeeCharged] = useState<number | null>(null);
  const displayFeeCents = resolvedSpotPrice !== null ? resolvedSpotPrice : (resolvedFeeCharged ?? entryFeeCents);
  const isSpot = spotPriceCents !== null;

  const btnSize = large ? "lg" : "sm";
  const btnStyle = {
    background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 48%))",
    boxShadow: large
      ? "0 0 28px hsl(258 82% 60% / 0.45), 0 4px 16px hsl(258 82% 50% / 0.3)"
      : "0 0 14px hsl(258 82% 60% / 0.35)",
  };

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
      if (data.data?.feeChargedCents !== undefined) {
        setResolvedFeeCharged(data.data.feeChargedCents);
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

  if (status === "pending" && pix) {
    return (
      <>
        <Button size={btnSize} onClick={() => setPixOpen(true)} className="gap-2" style={btnStyle}>
          <QrCode className={large ? "h-5 w-5" : "h-4 w-4"} />
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

  if (status === "pending") {
    return (
      <span className={`font-semibold text-amber-400 ${large ? "text-sm" : "text-xs"}`}>
        {t.catalogJoinBtn.requestSent}
      </span>
    );
  }

  const label = loading
    ? "..."
    : isSpot && resolvedSpotPrice === null
    ? t.catalog.joinSpot
    : isSpot && displayFeeCents > 0
    ? t.catalog.buySpot
    : displayFeeCents > 0
    ? t.catalogJoinBtn.join(formatCurrency(displayFeeCents, currency))
    : t.catalogJoinBtn.request;

  return (
    <>
      <Button size={btnSize} onClick={handleJoin} disabled={loading} className="gap-2" style={btnStyle}>
        {isSpot && !loading && <Zap className={large ? "h-5 w-5" : "h-3.5 w-3.5"} />}
        {label}
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
