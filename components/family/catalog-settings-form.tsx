"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe, Lock, Users, Crown, Unlock, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { FamilyCoverArt } from "@/components/family-cover-art";
import { useLanguage } from "@/lib/i18n/context";

type Props = {
  familyId: string;
  familyName: string;
  chiefName: string;
  chiefAvatar: string;
  chiefHasPixKey: boolean;
  initial: {
    isPublic: boolean;
    description: string | null;
    maxMembers: number | null;
    entryFeeCents: number;
    currency: string;
    memberCount: number;
    spotPricingEnabled: boolean;
    spotFraction: number;
    spotMinPriceCents: number;
  };
};

export function CatalogSettingsForm({ familyId, familyName, chiefName, chiefAvatar, chiefHasPixKey, initial }: Props) {
  const { t } = useLanguage();
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [description, setDescription] = useState(initial.description ?? "");
  const [maxMembers, setMaxMembers] = useState(initial.maxMembers?.toString() ?? "");
  const [entryFee, setEntryFee] = useState(
    initial.entryFeeCents > 0 ? (initial.entryFeeCents / 100).toFixed(2) : ""
  );
  const [spotEnabled, setSpotEnabled] = useState(initial.spotPricingEnabled);
  const [spotFraction, setSpotFraction] = useState(
    Math.round(initial.spotFraction * 100).toString()
  );
  const [spotMinPrice, setSpotMinPrice] = useState(
    initial.spotMinPriceCents > 0 ? (initial.spotMinPriceCents / 100).toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);

  const previewFeeCents = entryFee ? Math.round(parseFloat(entryFee) * 100) : 0;
  const previewMax = maxMembers ? parseInt(maxMembers) : null;
  const spotFractionValue = spotFraction ? Math.min(1, Math.max(0.01, parseFloat(spotFraction) / 100)) : 0.2;
  const spotMinPriceCents = spotMinPrice ? Math.round(parseFloat(spotMinPrice) * 100) : 0;

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
          entryFeeCents: spotEnabled ? 0 : previewFeeCents,
          spotPricingEnabled: spotEnabled,
          spotFraction: spotFractionValue,
          spotMinPriceCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.catalogSettings.saveError);
        return;
      }
      toast.success(isPublic ? t.catalogSettings.published : t.catalogSettings.saved);
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
              ? <><Globe className="h-3.5 w-3.5 text-primary" /> {t.catalogSettings.publicLabel}</>
              : <><Lock className="h-3.5 w-3.5 text-muted-foreground" /> {t.catalogSettings.privateLabel}</>
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {isPublic ? t.catalogSettings.publicDesc : t.catalogSettings.privateDesc}
          </p>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-sm">{t.catalogSettings.description}</Label>
        <Textarea
          placeholder={t.catalogSettings.descriptionPlaceholder}
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
          <Label className="text-sm">{t.catalogSettings.maxMembers}</Label>
          <Input
            type="number" min={2} max={100}
            placeholder={t.catalogSettings.noLimit}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t.catalogSettings.entryFee(initial.currency)}</Label>
          <Input
            type="number" min={0} step={0.01}
            placeholder={t.catalogSettings.free}
            value={spotEnabled ? "" : entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            disabled={spotEnabled}
            className="text-sm"
          />
        </div>
      </div>

      {/* Spot pricing */}
      <div className={`space-y-4 rounded-lg border p-4 transition-colors ${spotEnabled ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/20"}`}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              {t.catalogSettings.spotPricingLabel}
            </p>
            <p className="text-xs text-muted-foreground">{t.catalogSettings.spotPricingDesc}</p>
          </div>
          <Switch checked={spotEnabled} onCheckedChange={setSpotEnabled} />
        </div>

        {spotEnabled && !chiefHasPixKey && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            {t.catalogSettings.spotPixKeyWarning}
          </p>
        )}

        {spotEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{t.catalogSettings.spotFraction}</Label>
              <div className="relative">
                <Input
                  type="number" min={1} max={100} step={1}
                  placeholder="20"
                  value={spotFraction}
                  onChange={(e) => setSpotFraction(e.target.value)}
                  className="text-sm pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.catalogSettings.spotFractionHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.catalogSettings.spotMinPrice(initial.currency)}</Label>
              <Input
                type="number" min={0} step={0.01}
                placeholder={t.catalogSettings.free}
                value={spotMinPrice}
                onChange={(e) => setSpotMinPrice(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{t.catalogSettings.spotMinPriceHint}</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t.catalogSettings.previewLabel}</p>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden max-w-[240px]">
          <div className="h-16 overflow-hidden">
            <FamilyCoverArt familyId={familyId} />
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
                {t.catalogSettings.members(initial.memberCount, previewMax)}
              </span>
              {previewFeeCents > 0
                ? <span className="text-primary font-semibold">{formatCurrency(previewFeeCents, initial.currency)}</span>
                : <span className="text-emerald-400 flex items-center gap-0.5"><Unlock className="h-2.5 w-2.5" /> {t.catalogSettings.free}</span>
              }
            </div>
            <div className="h-6 rounded-md text-[10px] font-semibold text-white flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}>
              {previewFeeCents > 0 ? t.catalogSettings.joinBtn(formatCurrency(previewFeeCents, initial.currency)) : t.catalogSettings.joinFree}
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        {saving ? t.catalogSettings.saving : isPublic ? t.catalogSettings.savePublic : t.catalogSettings.savePrivate}
      </Button>
    </div>
  );
}
