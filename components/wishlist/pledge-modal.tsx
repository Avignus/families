"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemId: string;
  gameName: string;
  targetPriceCents: number;
  totalPledgedCents: number;
  currency: string;
  onSuccess: () => void;
};

export function PledgeModal({
  open, onOpenChange, itemId, gameName,
  targetPriceCents, totalPledgedCents, currency, onSuccess,
}: Props) {
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);

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
        toast.error(data.error?.message ?? "Erro ao registrar contribuição");
        return;
      }
      toast.success(`Contribuição de ${formatCurrency(amountCents, currency)} registrada!`);
      onOpenChange(false);
      setAmountStr("");
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contribuir para {gameName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Preço alvo: <span className="text-foreground font-medium">{formatCurrency(targetPriceCents, currency)}</span></div>
            <div>Já contribuído: <span className="text-foreground font-medium">{formatCurrency(totalPledgedCents, currency)}</span></div>
            <div>Restante: <span className="text-foreground font-medium">{formatCurrency(remaining, currency)}</span></div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Sua contribuição ({currency})</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={(remaining / 100).toFixed(2)}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0,00"
              required
            />
            {amountCents > 0 && (
              <p className="text-xs mt-1.5">
                {isValid ? (
                  <span className="text-primary">
                    Você vai cobrir {percent}% deste jogo
                    {totalPledgedCents + amountCents >= targetPriceCents && " — isso vai financiá-lo completamente!"}
                  </span>
                ) : (
                  <span className="text-destructive">
                    Valor excede o restante ({formatCurrency(remaining, currency)})
                  </span>
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? "Registrando..." : "Confirmar Contribuição"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
