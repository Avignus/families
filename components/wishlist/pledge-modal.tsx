"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PixPaymentModal } from "./pix-payment-modal";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemId: string;
  gameName: string;
  targetPriceCents: number;
  totalPledgedCents: number;
  currency: string;
  onSuccess: () => void;
  initialAmountCents?: number;
};

export function PledgeModal({
  open, onOpenChange, itemId, gameName,
  targetPriceCents, totalPledgedCents, currency, onSuccess, initialAmountCents,
}: Props) {
  const { t } = useLanguage();
  const [amountStr, setAmountStr] = useState("");

  useEffect(() => {
    if (open && initialAmountCents && initialAmountCents > 0) {
      setAmountStr((initialAmountCents / 100).toFixed(2));
    }
  }, [open, initialAmountCents]);
  const [loading, setLoading] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  const remaining = targetPriceCents - totalPledgedCents;
  const amountCents = Math.round(parseFloat(amountStr.replace(",", ".")) * 100) || 0;
  const percent = targetPriceCents > 0 ? Math.round((amountCents / targetPriceCents) * 100) : 0;
  const isValid = amountCents > 0 && amountCents <= remaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/wishlist/${itemId}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message ?? t.pledge.error);
        return;
      }

      setConfirmedAmount(amountCents);
      setPixData(data.data?.pix ?? null);
      onOpenChange(false);
      setAmountStr("");
      setPixOpen(true);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.pledge.title(gameName)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{t.pledge.targetPrice}</p>
                <p className="font-semibold">{formatCurrency(targetPriceCents, currency)}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{t.pledge.contributed}</p>
                <p className="font-semibold">{formatCurrency(totalPledgedCents, currency)}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{t.pledge.remaining}</p>
                <p className="font-semibold text-primary">{formatCurrency(remaining, currency)}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t.pledge.yourContribution(currency)}
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={(remaining / 100).toFixed(2)}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                required
                className="text-lg"
              />
              {amountCents > 0 && (
                <p className={`text-xs mt-1.5 ${isValid ? "text-primary" : "text-destructive"}`}>
                  {isValid
                    ? t.pledge.willCover(percent, totalPledgedCents + amountCents >= targetPriceCents)
                    : t.pledge.exceedsRemaining(formatCurrency(remaining, currency))}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-secondary/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
              {t.pledge.pixNote.split("QR Code PIX").map((part, i, arr) =>
                i < arr.length - 1
                  ? <span key={i}>{part}<strong>QR Code PIX</strong></span>
                  : <span key={i}>{part}</span>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.pledge.cancel}
              </Button>
              <Button type="submit" disabled={loading || !isValid}>
                {loading ? t.pledge.processing : t.pledge.submit(isValid ? formatCurrency(amountCents, currency) : "")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PixPaymentModal
        open={pixOpen}
        onOpenChange={setPixOpen}
        amountCents={confirmedAmount}
        currency={currency}
        gameName={gameName}
        pix={pixData}
      />
    </>
  );
}
