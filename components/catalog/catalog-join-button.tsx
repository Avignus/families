"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { QrCode, Zap, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

  // Spot terms modal state
  const [termsOpen, setTermsOpen] = useState(false);
  const [termChecked1, setTermChecked1] = useState(false);
  const [termChecked2, setTermChecked2] = useState(false);
  const [termChecked3, setTermChecked3] = useState(false);
  const allChecked = termChecked1 && termChecked2 && termChecked3;

  const btnSize = large ? "lg" : "sm";
  const btnStyle = {
    background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 48%))",
    boxShadow: large
      ? "0 0 28px hsl(258 82% 60% / 0.45), 0 4px 16px hsl(258 82% 50% / 0.3)"
      : "0 0 14px hsl(258 82% 60% / 0.35)",
  };

  const handleJoin = async () => {
    if (isSpot && resolvedSpotPrice !== 0) {
      // Open terms modal before spot purchase
      setTermChecked1(false);
      setTermChecked2(false);
      setTermChecked3(false);
      setTermsOpen(true);
      return;
    }
    await submitJoinRequest(false);
  };

  const handleTermsConfirm = async () => {
    setTermsOpen(false);
    await submitJoinRequest(true);
  };

  const submitJoinRequest = async (spotTermsAccepted: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spotTermsAccepted ? { spotTermsAccepted: true } : {}),
      });
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

      {/* Spot terms modal */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Antes de comprar o spot
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex gap-3 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              O funcionamento dos spots depende do recurso <strong>Steam Families</strong>, controlado pela Valve e sujeito a alterações a qualquer momento sem aviso prévio.
            </p>
          </div>

          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3">
              <input
                id="term1"
                type="checkbox"
                checked={termChecked1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermChecked1(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer shrink-0"
              />
              <Label htmlFor="term1" className="text-sm leading-snug cursor-pointer">
                Entendo que a plataforma <strong>Families não é afiliada à Valve/Steam</strong> e que esta taxa é pelo serviço de intermediação.
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="term2"
                type="checkbox"
                checked={termChecked2}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermChecked2(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer shrink-0"
              />
              <Label htmlFor="term2" className="text-sm leading-snug cursor-pointer">
                Estou ciente de que, caso o chefe me remova antes de 1 ano, terei direito a um <strong>reembolso proporcional</strong> ao tempo restante, creditado na minha carteira.
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="term3"
                type="checkbox"
                checked={termChecked3}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermChecked3(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer shrink-0"
              />
              <Label htmlFor="term3" className="text-sm leading-snug cursor-pointer">
                Compreendo que mudanças no recurso Steam Families feitas pela Valve estão <strong>fora do controle da plataforma</strong> e não geram direito a reembolso pela Families.
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTermsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTermsConfirm}
              disabled={!allChecked || loading}
              style={btnStyle}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {loading ? "Aguarde..." : "Confirmar e pagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
