"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle2, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [pixKey, setPixKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setPixKey(d.data?.pixKey ?? "");
        setInitialLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixKey: pixKey.trim() || null }),
    });
    setLoading(false);
    setSaved(true);
  }

  return (
    <div className="container py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Chave PIX para recebimento
          </CardTitle>
          <CardDescription>
            Quando um jogo da sua wishlist for totalmente financiado e todos os pagamentos aprovados,
            o valor será transferido automaticamente para esta chave.
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
                />
                <p className="text-xs text-muted-foreground">
                  Aceita qualquer tipo de chave PIX cadastrada na sua conta bancária.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvo
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
