"use client";

import { useState } from "react";
import { Link2, Copy, RefreshCw, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InviteLinkPanel({ familyId, initialToken, appUrl }: {
  familyId: string;
  initialToken: string | null;
  appUrl: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState<"generate" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = token ? `${appUrl}/join/${token}` : null;

  const generate = async () => {
    setLoading("generate");
    try {
      const res = await fetch(`/api/families/${familyId}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error("Erro ao gerar convite"); return; }
      setToken(data.data.token);
      toast.success("Link de convite gerado!");
    } finally {
      setLoading(null);
    }
  };

  const revoke = async () => {
    setLoading("revoke");
    try {
      const res = await fetch(`/api/families/${familyId}/invite`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao revogar convite"); return; }
      setToken(null);
      toast.success("Link revogado. Links anteriores não funcionam mais.");
    } finally {
      setLoading(null);
    }
  };

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {inviteUrl ? (
        <>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-secondary px-2 py-1.5 rounded flex-1 truncate text-muted-foreground">
              {inviteUrl}
            </code>
            <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={generate}
              disabled={loading !== null}
              className="gap-1.5 text-muted-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading === "generate" ? "animate-spin" : ""}`} />
              Regenerar
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={revoke}
              disabled={loading !== null}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revogar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Qualquer pessoa com este link pode solicitar entrada. Regenere para invalidar links antigos.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Nenhum link ativo. Gere um para convidar pessoas diretamente.</p>
          <Button
            size="sm"
            onClick={generate}
            disabled={loading !== null}
            className="gap-1.5"
          >
            <Link2 className={`h-4 w-4 ${loading === "generate" ? "animate-spin" : ""}`} />
            {loading === "generate" ? "Gerando..." : "Gerar link de convite"}
          </Button>
        </>
      )}
    </div>
  );
}
