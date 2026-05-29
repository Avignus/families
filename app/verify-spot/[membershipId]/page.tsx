"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, AlertTriangle, Image as ImageIcon, ExternalLink } from "lucide-react";

type Status = "idle" | "uploading" | "verified" | "rejected" | "error";
type Chief = { personaName: string; avatarMedium: string; steamId: string };

export default function VerifySpotPage() {
  const { membershipId } = useParams<{ membershipId: string }>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [chief, setChief] = useState<Chief | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/spot-verification/${membershipId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.chief) setChief(data.data.chief);
      })
      .catch(() => {});
  }, [membershipId]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setMessage("Selecione um arquivo de imagem."); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("Imagem deve ter menos de 10MB."); return; }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setStatus("uploading");
    setMessage("");

    const form = new FormData();
    form.append("image", file);

    try {
      const res = await fetch(`/api/spot-verification/${membershipId}`, { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error?.message ?? "Erro ao enviar imagem.");
        return;
      }

      if (data.data?.verified) {
        setStatus("verified");
        setMessage(data.data.message);
      } else {
        setStatus("rejected");
        setMessage(data.data?.message ?? "Não foi possível verificar. Tente novamente.");
      }
    } catch {
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const requestRefund = async () => {
    setRefunding(true);
    try {
      const res = await fetch(`/api/spot-verification/${membershipId}`, { method: "DELETE" });
      const data = await res.json();
      setRefunded(true);
      setMessage(data.data?.message ?? "Estorno solicitado.");
    } catch {
      setMessage("Erro ao solicitar estorno. Tente novamente.");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Confirmar entrada na família
          </h1>
          <p className="text-sm text-muted-foreground">
            Tire um print mostrando que você aparece na lista de membros da família Steam e envie abaixo.
          </p>
        </div>

        {/* Chief card */}
        {chief && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chief.avatarMedium} alt={chief.personaName} className="h-10 w-10 rounded-full shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Chefe da família</p>
              <p className="text-sm font-semibold truncate">{chief.personaName}</p>
            </div>
            <a
              href={`https://steamcommunity.com/profiles/${chief.steamId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
            >
              Ver Steam <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* How-to */}
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">Como tirar o print correto:</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Abra o <strong>Steam</strong> no computador</li>
            <li>Vá em <strong>Steam → Família Steam</strong> no menu superior</li>
            <li>Tire um print mostrando seu nome na lista de membros</li>
            <li>Envie a imagem abaixo</li>
          </ol>
        </div>

        {/* Upload area */}
        {status !== "verified" && !refunded && (
          <div
            className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              status === "uploading"
                ? "border-primary/50 bg-primary/5"
                : "border-border/50 hover:border-primary/40 hover:bg-accent/20"
            }`}
            onClick={() => status !== "uploading" && fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              )}
              {status === "uploading" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Analisando imagem...
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Clique ou arraste a imagem aqui</p>
                  <p className="text-xs mt-0.5">PNG, JPG, WEBP — até 10MB</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {status === "verified" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-400">Verificação concluída!</p>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          </div>
        )}

        {status === "rejected" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-400">Não foi possível verificar</p>
              <p className="text-sm text-muted-foreground">{message}</p>
              <button
                onClick={() => { setStatus("idle"); setPreview(null); setMessage(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="mt-2 text-xs underline text-primary"
              >
                Tentar com outra imagem
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}

        {refunded && (
          <div className="rounded-xl border border-border/40 bg-card p-4 text-sm text-muted-foreground text-center">
            {message}
          </div>
        )}

        {/* Refund option */}
        {status !== "verified" && !refunded && (
          <div className="pt-2 border-t border-border/30 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              O chefe não te adicionou à família Steam?
            </p>
            <button
              onClick={requestRefund}
              disabled={refunding}
              className="text-xs text-destructive/80 underline underline-offset-2 hover:text-destructive disabled:opacity-50"
            >
              {refunding ? "Processando..." : "Solicitar estorno — não fui adicionado"}
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground/40 text-center">
          <Clock className="inline h-3 w-3 mr-1" />
          Prazo de 5 dias após o pagamento para enviar o comprovante.
        </p>
      </div>
    </div>
  );
}
