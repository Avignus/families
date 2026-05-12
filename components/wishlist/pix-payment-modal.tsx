"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Copy, Check, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amountCents: number;
  currency: string;
  gameName: string;
  pix: PixData | null;
};

export function PixPaymentModal({ open, onOpenChange, amountCents, currency, gameName, pix }: Props) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagar via PIX
          </DialogTitle>
          <DialogDescription>
            Contribuição de <strong>{formatCurrency(amountCents, currency)}</strong> para{" "}
            <strong>{gameName}</strong>
          </DialogDescription>
        </DialogHeader>

        {!pix ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Contribuição registrada! O pagamento via PIX não está configurado neste ambiente.
            </p>
            <p className="text-xs text-muted-foreground">
              Configure <code className="bg-secondary px-1 rounded">MERCADOPAGO_ACCESS_TOKEN</code> para ativar PIX.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* QR Code image */}
            {pix.qrCodeBase64 && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl">
                  <img
                    src={`data:image/png;base64,${pix.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Escaneie com seu banco ou use o código abaixo
            </p>

            {/* Copy & paste code */}
            <div className="space-y-2">
              <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                <p className="text-[11px] text-muted-foreground mb-1 font-medium">PIX Copia e Cola</p>
                <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">
                  {pix.qrCode.slice(0, 60)}...
                </p>
              </div>

              <Button
                className="w-full"
                onClick={copyCode}
                variant={copied ? "secondary" : "default"}
              >
                {copied ? (
                  <><Check className="h-4 w-4 mr-2" /> Copiado!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" /> Copiar Código PIX</>
                )}
              </Button>
            </div>

            {/* External link */}
            {pix.ticketUrl && (
              <a
                href={pix.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir no MercadoPago
              </a>
            )}

            <div className="text-[11px] text-muted-foreground text-center space-y-1 border-t border-border/50 pt-3">
              <p>O pagamento expira em <strong>24 horas</strong>.</p>
              <p>Após confirmar o PIX, sua contribuição será marcada como paga automaticamente.</p>
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          {pix ? "Fechar — pagarei depois" : "Fechar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
