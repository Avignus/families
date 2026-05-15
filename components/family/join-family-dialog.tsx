"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

export function JoinFamilyDialog() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId.trim()}/join-requests`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.joinFamily.error);
        return;
      }
      toast.success(t.joinFamily.success);
      setOpen(false);
      setFamilyId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-secondary/60 active:scale-[0.98]"
          style={{ borderColor: "hsl(258 82% 60% / 0.4)", color: "hsl(258 82% 72%)" }}>
          <LogIn className="h-4 w-4" /> {t.joinFamily.trigger}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.joinFamily.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t.joinFamily.idLabel}</label>
            <Input
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              placeholder={t.joinFamily.idPlaceholder}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t.joinFamily.idHint}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.joinFamily.cancel}</Button>
            <Button type="submit" disabled={loading || !familyId.trim()}>
              {loading ? t.joinFamily.sending : t.joinFamily.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
