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
import { Wallet, CreditCard } from "lucide-react";

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
  userCreditsCents: number;
  onSuccess: () => void;
  initialAmountCents?: number;
};

export function PledgeModal({
  open, onOpenChange, itemId, gameName,
  targetPriceCents, totalPledgedCents, currency, userCreditsCents, onSuccess, initialAmountCents,
}: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [inputStr, setInputStr] = useState("");

  useEffect(() => {
    if (open && initialAmountCents && initialAmountCents > 0) {
      setMode("amount");
      setInputStr((initialAmountCents / 100).toFixed(2));
    }
  }, [open, initialAmountCents]);
  const [loading, setLoading] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  const [pledgeId, setPledgeId] = useState<string | null>(null);

  const remaining = targetPriceCents - totalPledgedCents;
  const inputNum = parseFloat(inputStr.replace(",", ".")) || 0;
  const amountCents = mode === "amount"
    ? Math.round(inputNum * 100)
    : Math.round((inputNum / 100) * targetPriceCents);
  const percent = targetPriceCents > 0 ? Math.round((amountCents / targetPriceCents) * 100) : 0;
  const isValid = amountCents > 0 && amountCents <= remaining;

  // Credits vs PIX split (mirrors backend logic)
  const creditsUsed = Math.min(userCreditsCents, amountCents);
  const pixPortion = amountCents - creditsUsed;

  const switchMode = (next: "amount" | "percent") => {
    if (next === mode) return;
    if (next === "percent") {
      setInputStr(amountCents > 0 ? String(percent) : "");
    } else {
      setInputStr(amountCents > 0 ? (amountCents / 100).toFixed(2) : "");
    }
    setMode(next);
  };

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
      setPledgeId(data.data?.pledge?.id ?? null);
      onOpenChange(false);
      setInputStr("");
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">
                  {t.pledge.yourContribution(currency)}
                </label>
                <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
                  {(["amount", "percent"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`px-2.5 py-1 transition-colors ${
                        mode === m
                          ? "bg-primary text-white font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "amount" ? currency : "%"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min="0.01"
                  step={mode === "percent" ? "1" : "0.01"}
                  max={mode === "percent" ? "100" : (remaining / 100).toFixed(2)}
                  value={inputStr}
                  onChange={(e) => setInputStr(e.target.value)}
                  placeholder={mode === "percent" ? "0" : "0,00"}
                  required
                  className="text-lg pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {mode === "percent" ? "%" : currency}
                </span>
              </div>
              {amountCents > 0 && (
                <p className={`text-xs mt-1.5 ${isValid ? "text-primary" : "text-destructive"}`}>
                  {isValid
                    ? `${formatCurrency(amountCents, currency)} · ${t.pledge.willCover(percent, totalPledgedCents + amountCents >= targetPriceCents)}`
                    : t.pledge.exceedsRemaining(formatCurrency(remaining, currency))}
                </p>
              )}
            </div>

            {/* Payment split preview */}
            {amountCents > 0 && isValid ? (
              <div className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5 space-y-1.5 text-xs">
                {creditsUsed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="h-3 w-3" style={{ color: "hsl(258 82% 66%)" }} />
                      Saldo da carteira
                    </span>
                    <span className="font-semibold" style={{ color: "hsl(258 82% 66%)" }}>
                      − {formatCurrency(creditsUsed, currency)}
                    </span>
                  </div>
                )}
                {pixPortion > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      PIX (QR Code)
                    </span>
                    <span className="font-semibold">{formatCurrency(pixPortion, currency)}</span>
                  </div>
                )}
                {pixPortion === 0 && (
                  <p className="text-center text-muted-foreground">
                    Coberto integralmente pelo seu saldo — sem PIX necessário.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-secondary/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
                {t.pledge.pixNote.split("QR Code PIX").map((part, i, arr) =>
                  i < arr.length - 1
                    ? <span key={i}>{part}<strong>QR Code PIX</strong></span>
                    : <span key={i}>{part}</span>
                )}
              </div>
            )}

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
        pollUrl={pledgeId ? `/api/pledges/${pledgeId}` : undefined}
        onConfirmed={onSuccess}
      />
    </>
  );
}
