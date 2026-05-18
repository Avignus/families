"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Banknote, ArrowDownToLine, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type WithdrawInfo = {
  availableCents: number;
  feeBps: number;
  feeCents: number;
  netCents: number;
  minWithdrawalCents: number;
};

export function WithdrawPanel({ hasPixKey }: { hasPixKey: boolean }) {
  const { t } = useLanguage();
  const [info, setInfo] = useState<WithdrawInfo | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInfo = async () => {
    const res = await fetch("/api/me/withdraw");
    const data = await res.json();
    if (res.ok) setInfo(data.data);
  };

  useEffect(() => { fetchInfo(); }, []);

  if (!info) return null;
  if (info.availableCents === 0) return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          {t.withdraw.title}
        </CardTitle>
        <CardDescription>{t.withdraw.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t.withdraw.noBalance}</p>
      </CardContent>
    </Card>
  );

  const inputCents = Math.round(parseFloat(amountStr.replace(",", ".") || "0") * 100);
  const isValidAmount = inputCents >= info.minWithdrawalCents && inputCents <= info.availableCents;
  const previewFee = Math.round(inputCents * info.feeBps / 10000);
  const previewNet = inputCents - previewFee;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;
    setLoading(true);
    try {
      const res = await fetch("/api/me/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: inputCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao processar saque");
        return;
      }
      toast.success(t.withdraw.submitBtn + ` — ${formatCurrency(data.data.netCents, "BRL")}`);
      setAmountStr("");
      await fetchInfo();
    } finally {
      setLoading(false);
    }
  };

  const feePercent = (info.feeBps / 100).toFixed(0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          {t.withdraw.title}
        </CardTitle>
        <CardDescription>{t.withdraw.feeDescription(feePercent)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums" style={{ color: "hsl(258 82% 72%)" }}>
            {formatCurrency(info.availableCents, "BRL")}
          </span>
          <span className="text-xs text-muted-foreground">{t.withdraw.available}</span>
        </div>

        {!hasPixKey && (
          <p className="text-xs text-amber-400">{t.withdraw.pixKeyRequired}</p>
        )}

        {hasPixKey && (
          <form onSubmit={handleWithdraw} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min={(info.minWithdrawalCents / 100).toFixed(2)}
                  max={(info.availableCents / 100).toFixed(2)}
                  step="0.01"
                  placeholder={t.withdraw.minPlaceholder(formatCurrency(info.minWithdrawalCents, "BRL"))}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setAmountStr((info.availableCents / 100).toFixed(2))}
              >
                {t.withdraw.all}
              </Button>
            </div>

            {inputCents > 0 && (
              <div className="rounded-lg bg-secondary/40 border border-border/40 px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.withdraw.grossAmount}</span>
                  <span>{formatCurrency(inputCents, "BRL")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.withdraw.fee(feePercent)}</span>
                  <span>− {formatCurrency(previewFee, "BRL")}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border/40 pt-1 mt-1">
                  <span>{t.withdraw.youReceive}</span>
                  <span style={{ color: "hsl(258 82% 72%)" }}>{formatCurrency(previewNet, "BRL")}</span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isValidAmount}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><ArrowDownToLine className="h-4 w-4 mr-2" /> {t.withdraw.submitBtn}</>}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
