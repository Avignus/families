"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Copy, Check, ExternalLink, QrCode, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
  expiresAt?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amountCents: number;
  currency: string;
  gameName: string;
  pix: PixData | null;
  pollUrl?: string;           // endpoint to poll for confirmation
  onConfirmed?: () => void;   // called when payment is confirmed
};

function useCountdown(expiresAt?: string) {
  const getRemaining = useCallback(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { h, m, s, expired: false };
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (!r) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, getRemaining]);

  return remaining;
}

export function PixPaymentModal({
  open, onOpenChange, amountCents, currency, gameName, pix, pollUrl, onConfirmed,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const countdown = useCountdown(pix?.expiresAt);

  // Poll for payment confirmation
  useEffect(() => {
    if (!open || !pollUrl || confirmed) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(pollUrl);
        if (!res.ok) return;
        const data = await res.json();
        if (data.data?.paid || data.data?.membershipStatus === "active") {
          setConfirmed(true);
          clearInterval(id);
          toast.success("Pagamento confirmado!");
          setTimeout(() => {
            onOpenChange(false);
            onConfirmed?.();
          }, 1800);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(id);
  }, [open, pollUrl, confirmed, onConfirmed, onOpenChange]);

  const copyCode = async () => {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagar via PIX
          </DialogTitle>
          <DialogDescription>
            {formatCurrency(amountCents, currency)} para <strong>{gameName}</strong>
          </DialogDescription>
        </DialogHeader>

        {confirmed ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="font-semibold text-emerald-400">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground">Redirecionando…</p>
          </div>
        ) : !pix ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              O pagamento via PIX não está configurado neste ambiente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Countdown */}
            {countdown !== null ? (
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-amber-400 font-semibold">
                  Expira em {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
                </span>
              </div>
            ) : pix.expiresAt ? (
              <p className="text-xs text-destructive text-center font-semibold">PIX expirado</p>
            ) : null}

            {/* QR Code */}
            {pix.qrCodeBase64 && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl">
                  <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48" />
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Escaneie com seu banco ou copie o código abaixo
            </p>

            <div className="space-y-2">
              <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                <p className="text-[11px] text-muted-foreground mb-1 font-medium">PIX Copia e Cola</p>
                <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">
                  {pix.qrCode.slice(0, 60)}…
                </p>
              </div>
              <Button className="w-full" onClick={copyCode} variant={copied ? "secondary" : "default"}>
                {copied ? <><Check className="h-4 w-4 mr-2" /> Copiado!</> : <><Copy className="h-4 w-4 mr-2" /> Copiar Código PIX</>}
              </Button>
            </div>

            {pix.ticketUrl && (
              <a href={pix.ticketUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Abrir link de pagamento
              </a>
            )}

            {pollUrl && (
              <p className="text-[11px] text-muted-foreground text-center border-t border-border/50 pt-3">
                O modal fechará automaticamente após a confirmação do pagamento.
              </p>
            )}
          </div>
        )}

        {!confirmed && (
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {pix ? "Fechar — pagarei depois" : "Fechar"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
