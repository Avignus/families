"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { useLanguage } from "@/lib/i18n/context";
import { Zap } from "lucide-react";

type PixData = { qrCode: string; qrCodeBase64: string; ticketUrl: string; paymentId: string };

export function JoinViaInviteButton({
  familyId, familyName, entryFeeCents, currency, spotPricingEnabled, spotPriceCents,
}: {
  familyId: string;
  familyName: string;
  entryFeeCents: number;
  currency: string;
  spotPricingEnabled?: boolean;
  spotPriceCents?: number | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [pixModal, setPixModal] = useState<PixData | null>(null);
  const [resolvedSpotPrice, setResolvedSpotPrice] = useState<number | null>(spotPriceCents ?? null);

  const isSpot = !!spotPricingEnabled;
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
        setPixModal(data.data.pix);
      } else {
        toast.success(t.catalogJoinBtn.success);
        router.push(`/families/${familyId}`);
      }
    } finally {
      setLoading(false);
    }
  };

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
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
      >
        {isSpot && !loading && <Zap className="h-4 w-4" />}
        {label}
      </button>

      {pixModal && (
        <PixPaymentModal
          open
          onOpenChange={(v) => { if (!v) setPixModal(null); }}
          amountCents={displayFeeCents}
          currency={currency}
          gameName={t.catalogJoinBtn.entryInto(familyName)}
          pix={pixModal}
          pollUrl={`/api/families/${familyId}/entry-status`}
          onConfirmed={() => router.push(`/families/${familyId}`)}
        />
      )}
    </>
  );
}
