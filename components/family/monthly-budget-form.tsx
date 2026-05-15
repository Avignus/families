"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Props = {
  familyId: string;
  currency: string;
  initialBudgetCents: number;
};

export function MonthlyBudgetForm({ familyId, currency, initialBudgetCents }: Props) {
  const { t } = useLanguage();
  const [value, setValue] = useState(
    initialBudgetCents > 0 ? (initialBudgetCents / 100).toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cents = value ? Math.round(parseFloat(value) * 100) : 0;
      const res = await fetch(`/api/families/${familyId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudgetCents: cents }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) { toast.error(data.error?.message ?? t.monthlyBudget.error); return; }
      toast.success(cents > 0 ? t.monthlyBudget.success(currency, (cents / 100).toFixed(2)) : t.monthlyBudget.disabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/30">
      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{t.monthlyBudget.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {t.monthlyBudget.desc}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{currency}</span>
        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="0,00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 h-7 text-xs"
        />
        <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={saving}>
          {saving ? "..." : t.monthlyBudget.save}
        </Button>
      </div>
    </div>
  );
}
