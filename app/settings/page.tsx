"use client";

import { useEffect, useState, useDeferredValue } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle2, Loader2, Star, XCircle, Mail, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ReputationBadge } from "@/components/reputation-badge";
import { getTier, TIER_LABELS } from "@/lib/reputation";
import { formatCurrency } from "@/lib/utils";
import { validatePixKey } from "@/lib/pix-key";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { personaName?: string; avatarMedium?: string; image?: string } | undefined;
  const [pixKey, setPixKey] = useState("");
  const [email, setEmail] = useState("");
  const [reputationScore, setReputationScore] = useState<number | null>(null);
  const [creditsCents, setCreditsCents] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const deferredKey = useDeferredValue(pixKey);
  const validation = deferredKey.trim() ? validatePixKey(deferredKey.trim()) : null;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setPixKey(d.data?.pixKey ?? "");
        setEmail(d.data?.email ?? "");
        setReputationScore(d.data?.reputationScore ?? 0);
        setCreditsCents(d.data?.creditsCents ?? 0);
        setInitialLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pixKey.trim() && validation && !validation.valid) return;

    setLoading(true);
    setSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixKey: pixKey.trim() || null }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Erro ao salvar");
      return;
    }
    setSaved(true);
    toast.success("Chave PIX salva!");
  }

  async function handleDeleteAccount() {
    if (!confirm("Tem certeza? Esta ação é irreversível e excluirá todos os seus dados.")) return;
    setDeleteLoading(true);
    const res = await fetch("/api/me/account", { method: "DELETE" });
    if (res.ok) {
      router.push("/api/auth/signout?callbackUrl=/");
    } else {
      const data = await res.json();
      toast.error(data.error?.message ?? "Erro ao excluir conta");
      setDeleteLoading(false);
    }
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid) return;

    setEmailLoading(true);
    setEmailSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || null }),
    });
    const data = await res.json();
    setEmailLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Erro ao salvar email");
      return;
    }
    setEmailSaved(true);
    toast.success(email.trim() ? "Email salvo!" : "Email removido!");
  }

  return (
    <div className="container py-8 max-w-lg">
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-14 w-14 ring-2 ring-border">
          <AvatarImage src={sessionUser?.avatarMedium ?? sessionUser?.image ?? ""} alt={sessionUser?.personaName ?? ""} />
          <AvatarFallback className="text-lg bg-primary/20 text-primary">
            {(sessionUser?.personaName ?? "?")[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{sessionUser?.personaName ?? "Carregando..."}</h1>
          <p className="text-sm text-muted-foreground">Configurações da conta</p>
        </div>
      </div>

      {reputationScore !== null && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-400" />
              Reputação
            </CardTitle>
            <CardDescription>
              Seu score é calculado com base em contribuições pagas, velocidade de pagamento e jogos financiados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ReputationBadge score={reputationScore} showScore size="md" />
            <div className="text-sm text-muted-foreground">
              {reputationScore === 0
                ? "Faça sua primeira contribuição para começar a construir sua reputação."
                : `Tier: ${TIER_LABELS[getTier(reputationScore)]}`}
            </div>
          </CardContent>
        </Card>
      )}

      {creditsCents !== null && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              Créditos na plataforma
            </CardTitle>
            <CardDescription>
              Gerados quando um item da wishlist é cancelado. Usados automaticamente na sua próxima contribuição.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: creditsCents > 0 ? "hsl(258 82% 72%)" : undefined }}
              >
                {formatCurrency(creditsCents, "BRL")}
              </span>
              {creditsCents > 0 && (
                <span className="text-xs text-muted-foreground">disponível para contribuições</span>
              )}
              {creditsCents === 0 && (
                <span className="text-xs text-muted-foreground">sem créditos no momento</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Chave PIX para recebimento
          </CardTitle>
          <CardDescription>
            Usada para receber valores de financiamento de jogos e taxas de entrada da sua família.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pixKey" className="text-sm font-medium">Chave PIX</label>
                <Input
                  id="pixKey"
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  value={pixKey}
                  onChange={(e) => { setPixKey(e.target.value); setSaved(false); }}
                  className={
                    validation
                      ? validation.valid
                        ? "border-emerald-500/60 focus-visible:ring-emerald-500/30"
                        : "border-destructive/60 focus-visible:ring-destructive/30"
                      : ""
                  }
                />

                {/* Live feedback */}
                {validation && (
                  <div className={`flex items-center gap-1.5 text-xs ${validation.valid ? "text-emerald-400" : "text-destructive"}`}>
                    {validation.valid ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> {validation.label} detectado</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5" /> {validation.error}</>
                    )}
                  </div>
                )}

                {!validation && (
                  <p className="text-xs text-muted-foreground">
                    Aceita CPF, CNPJ, e-mail, telefone (+55) ou chave aleatória.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={loading || (!!pixKey.trim() && !!validation && !validation.valid)}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvo
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Notificações por email
          </CardTitle>
          <CardDescription>
            Receba emails para eventos importantes: jogo financiado, repasse enviado, aprovação em família.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailSaved(false); }}
                  className={
                    email.trim() && !emailValid
                      ? "border-destructive/60 focus-visible:ring-destructive/30"
                      : ""
                  }
                />
                {email.trim() && !emailValid && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> Email inválido
                  </div>
                )}
                {!email.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Opcional. Deixe em branco para não receber emails.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={emailLoading || !emailValid}>
                  {emailLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
                {emailSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvo
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" />
            Excluir conta
          </CardTitle>
          <CardDescription>
            Remove permanentemente sua conta e dados pessoais. Transações financeiras são retidas
            conforme obrigações legais. Esta ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleteLoading}
          >
            {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
