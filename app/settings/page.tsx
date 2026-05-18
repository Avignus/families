"use client";

import { useEffect, useState, useDeferredValue } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle2, Loader2, Star, XCircle, Mail, Trash2, Wallet, Plus } from "lucide-react";
import { PixPaymentModal } from "@/components/wishlist/pix-payment-modal";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ReputationBadge } from "@/components/reputation-badge";
import { getTier, TIER_LABELS } from "@/lib/reputation";
import { formatCurrency } from "@/lib/utils";
import { validatePixKey } from "@/lib/pix-key";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
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
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupPixOpen, setTopupPixOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [topupPix, setTopupPix] = useState<{ qrCode: string; qrCodeBase64: string; ticketUrl: string; paymentId: string; expiresAt?: string } | null>(null);
  const [topupAmountCents, setTopupAmountCents] = useState(0);
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
      toast.error(data.error?.message ?? t.settings.pixSaveError);
      return;
    }
    setSaved(true);
    toast.success(t.settings.pixSaved);
  }

  async function handleRecover() {
    setRecovering(true);
    try {
      const res = await fetch("/api/me/credits/recover", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === "NO_APPROVED_PAYMENTS" || data.error?.code === "ALREADY_PROCESSED") {
          toast.info(t.settings.noPendingCredits);
        } else {
          toast.error(data.error?.message ?? t.settings.recoverError);
        }
        return;
      }
      setCreditsCents((prev) => (prev ?? 0) + data.data.totalCredited);
      toast.success(t.settings.creditsRecovered(formatCurrency(data.data.totalCredited, "BRL")));
    } finally {
      setRecovering(false);
    }
  }

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(topupAmount.replace(",", ".")) * 100);
    if (!amountCents || amountCents < 2000) return;

    setTopupLoading(true);
    const res = await fetch("/api/me/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents }),
    });
    const data = await res.json();
    setTopupLoading(false);
    if (!res.ok) { toast.error(data.error?.message ?? t.settings.chargeError); return; }
    setTopupAmountCents(amountCents);
    setTopupPix(data.data?.pix ?? null);
    setTopupAmount("");
    setTopupPixOpen(true);
  }

  async function handleDeleteAccount() {
    if (!confirm(t.settings.deleteConfirm)) return;
    setDeleteLoading(true);
    const res = await fetch("/api/me/account", { method: "DELETE" });
    if (res.ok) {
      router.push("/api/auth/signout?callbackUrl=/");
    } else {
      const data = await res.json();
      toast.error(data.error?.message ?? t.settings.deleteError);
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
      toast.error(data.error?.message ?? t.settings.emailSaveError);
      return;
    }
    setEmailSaved(true);
    toast.success(email.trim() ? t.settings.emailSaved : t.settings.emailRemoved);
  }

  return (
    <div className="container py-8 max-w-lg">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex flex-col items-center gap-1">
          <Avatar className="h-14 w-14 ring-2 ring-border">
            <AvatarImage src={sessionUser?.avatarMedium ?? sessionUser?.image ?? ""} alt={sessionUser?.personaName ?? ""} />
            <AvatarFallback className="text-lg bg-primary/20 text-primary">
              {(sessionUser?.personaName ?? "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {creditsCents !== null && creditsCents > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums" style={{ color: "hsl(258 82% 72%)" }}>
              <Wallet className="h-3 w-3" />
              {formatCurrency(creditsCents, "BRL")}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{sessionUser?.personaName ?? t.settings.loading}</h1>
          <p className="text-sm text-muted-foreground">{t.settings.accountSettings}</p>
        </div>
      </div>

      {reputationScore !== null && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-400" />
              {t.settings.reputation}
            </CardTitle>
            <CardDescription>
              {t.settings.reputationDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ReputationBadge score={reputationScore} showScore size="md" />
            <div className="text-sm text-muted-foreground">
              {reputationScore === 0
                ? t.settings.reputationEmpty
                : t.settings.tier(TIER_LABELS[getTier(reputationScore)])}
            </div>
          </CardContent>
        </Card>
      )}

      {creditsCents !== null && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              {t.settings.creditsTitle}
            </CardTitle>
            <CardDescription>
              {t.settings.creditsDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: creditsCents > 0 ? "hsl(258 82% 72%)" : undefined }}
                >
                  {formatCurrency(creditsCents, "BRL")}
                </span>
                {creditsCents > 0 && (
                  <span className="text-xs text-muted-foreground">{t.settings.creditsAvailable}</span>
                )}
                {creditsCents === 0 && (
                  <span className="text-xs text-muted-foreground">{t.settings.noCredits}</span>
                )}
              </div>
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7 px-2"
                  onClick={handleRecover}
                  disabled={recovering}
                >
                  {recovering ? <Loader2 className="h-3 w-3 animate-spin" /> : "Recuperar créditos"}
                </Button>
              )}
            </div>

            <form onSubmit={handleTopup} className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min="20"
                  step="1"
                  placeholder="20,00"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={topupLoading || !topupAmount || parseFloat(topupAmount) < 20} size="sm">
                {topupLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Plus className="h-4 w-4 mr-1" /> {t.settings.addBtn}</>}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{t.settings.topupHint}</p>
          </CardContent>
        </Card>
      )}

      <PixPaymentModal
        open={topupPixOpen}
        onOpenChange={setTopupPixOpen}
        amountCents={topupAmountCents}
        currency="BRL"
        gameName="carteira"
        pix={topupPix}
        pollUrl={topupPix ? `/api/me/credits/${topupPix.paymentId}` : undefined}
        onConfirmed={() => {
          setCreditsCents((prev) => (prev ?? 0) + topupAmountCents);
          toast.success(t.settings.creditsAdded(formatCurrency(topupAmountCents, "BRL")));
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            {t.settings.pixTitle}
          </CardTitle>
          <CardDescription>
            {t.settings.pixDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.settings.loading}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pixKey" className="text-sm font-medium">{t.settings.pixKey}</label>
                <Input
                  id="pixKey"
                  placeholder={t.settings.pixPlaceholder}
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
                    {t.settings.pixHint}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={loading || (!!pixKey.trim() && !!validation && !validation.valid)}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.settings.save}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.settings.saved}
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
            {t.settings.emailTitle}
          </CardTitle>
          <CardDescription>
            {t.settings.emailDesc}
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
                <label htmlFor="email" className="text-sm font-medium">{t.settings.email}</label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.settings.emailPlaceholder}
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
                    <XCircle className="h-3.5 w-3.5" /> {t.settings.emailInvalid}
                  </div>
                )}
                {!email.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {t.settings.emailOptional}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={emailLoading || !emailValid}>
                  {emailLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.settings.save}
                </Button>
                {emailSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.settings.saved}
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
            {t.settings.deleteTitle}
          </CardTitle>
          <CardDescription>
            {t.settings.deleteDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleteLoading}
          >
            {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t.settings.deleteBtn}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
