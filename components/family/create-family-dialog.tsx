"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { generateFamilyName } from "@/lib/family-name-generator";
import { useLanguage } from "@/lib/i18n/context";

export function CreateFamilyDialog() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const handleShuffle = () => {
    setShuffling(true);
    setName(generateFamilyName());
    setTimeout(() => setShuffling(false), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), currency: "BRL" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message ?? t.createFamily.error);
        return;
      }
      const data = await res.json();
      toast.success(t.createFamily.success(name));
      setOpen(false);
      setName("");
      router.push(`/families/${data.data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 48%))", boxShadow: "0 0 16px hsl(258 82% 60% / 0.35)" }}
        >
          <Plus className="h-4 w-4" /> {t.createFamily.trigger}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.createFamily.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">{t.createFamily.nameLabel}</label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.createFamily.namePlaceholder}
                required
                maxLength={100}
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleShuffle}
                title="Sugerir nome"
                className={`flex-shrink-0 h-9 w-9 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all ${shuffling ? "animate-spin" : ""}`}
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t.createFamily.nameHint} <Shuffle className="h-3 w-3 inline" /> {t.createFamily.nameHint2}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.createFamily.cancel}</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? t.createFamily.creating : t.createFamily.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
