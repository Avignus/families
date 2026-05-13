"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe, Lock, Users, Crown, Unlock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Props = {
  familyId: string;
  familyName: string;
  chiefName: string;
  chiefAvatar: string;
  initial: {
    isPublic: boolean;
    description: string | null;
    maxMembers: number | null;
    entryFeeCents: number;
    currency: string;
    memberCount: number;
  };
};

export function CatalogSettingsForm({ familyId, familyName, chiefName, chiefAvatar, initial }: Props) {
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [description, setDescription] = useState(initial.description ?? "");
  const [maxMembers, setMaxMembers] = useState(initial.maxMembers?.toString() ?? "");
  const [entryFee, setEntryFee] = useState(
    initial.entryFeeCents > 0 ? (initial.entryFeeCents / 100).toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);

  const previewFeeCents = entryFee ? Math.round(parseFloat(entryFee) * 100) : 0;
  const previewMax = maxMembers ? parseInt(maxMembers) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublic,
          description: description.trim() || null,
          maxMembers: previewMax,
          entryFeeCents: previewFeeCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao salvar");
        return;
      }
      toast.success(isPublic ? "Família publicada no catálogo!" : "Configurações salvas!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Public toggle */}
      <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isPublic ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/30"}`}>
        <div className="space-y-0.5">
          <p className="text-sm font-medium flex items-center gap-1.5">
            {isPublic
              ? <><Globe className="h-3.5 w-3.5 text-primary" /> Família pública</>
              : <><Lock className="h-3.5 w-3.5 text-muted-foreground" /> Família privada</>
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {isPublic ? "Visível no catálogo — qualquer jogador pode pedir entrada." : "Só quem tiver o ID pode solicitar entrada."}
          </p>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-sm">Descrição</Label>
        <Textarea
          placeholder="Conte sobre a família: estilo de jogo, horários, requisitos..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Máximo de membros</Label>
          <Input
            type="number" min={2} max={100}
            placeholder="Sem limite"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Taxa de entrada ({initial.currency})</Label>
          <Input
            type="number" min={0} step={0.01}
            placeholder="Gratuito"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview do card no catálogo</p>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden max-w-[240px]">
          <div className="h-16 bg-secondary flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <div className="p-3 space-y-2">
            <p className="font-semibold text-xs truncate" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {familyName}
            </p>
            {description && (
              <p className="text-[10px] text-muted-foreground line-clamp-2">{description}</p>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <img src={chiefAvatar} alt="" className="h-3.5 w-3.5 rounded-full" />
              <span className="truncate max-w-[70px]">{chiefName}</span>
              <Crown className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {initial.memberCount}{previewMax ? `/${previewMax}` : ""} membros
              </span>
              {previewFeeCents > 0
                ? <span className="text-primary font-semibold">{formatCurrency(previewFeeCents, initial.currency)}</span>
                : <span className="text-emerald-400 flex items-center gap-0.5"><Unlock className="h-2.5 w-2.5" /> Gratuito</span>
              }
            </div>
            <div className="h-6 rounded-md text-[10px] font-semibold text-white flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}>
              {previewFeeCents > 0 ? `Entrar · ${formatCurrency(previewFeeCents, initial.currency)}` : "Pedir entrada"}
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        {saving ? "Salvando..." : isPublic ? "Publicar no catálogo" : "Salvar configurações"}
      </Button>
    </div>
  );
}
