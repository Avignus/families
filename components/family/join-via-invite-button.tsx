"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { useLanguage } from "@/lib/i18n/context";

type PixData = { qrCode: string; qrCodeBase64: string; ticketUrl: string; paymentId: string };

export function JoinViaInviteButton({
  familyId, familyName, entryFeeCents, currency,
}: {
  familyId: string;
  familyName: string;
  entryFeeCents: number;
  currency: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [pixModal, setPixModal] = useState<PixData | null>(null);

  const handleJoin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.catalogJoinBtn.error);
        return;
      }
      if (data.data?.pendingPayment && data.data?.pix) {
        setPixModal(data.data.pix);
      } else {
        toast.success(t.catalogJoinBtn.success);
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const hasFee = entryFeeCents > 0;

  return (
    <>
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
      >
        {loading
          ? "..."
          : hasFee
          ? t.catalogJoinBtn.join(formatCurrency(entryFeeCents, currency))
          : t.catalogJoinBtn.request}
      </button>

      {pixModal && (
        <PixPaymentModal
          open
          onOpenChange={(v) => { if (!v) setPixModal(null); }}
          amountCents={entryFeeCents}
          currency={currency}
          gameName={t.catalogJoinBtn.entryInto(familyName)}
          pix={pixModal}
        />
      )}
    </>
  );
}
