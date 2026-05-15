"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  familyId: string;
  familyName: string;
};

export function DeleteFamilyButton({ familyId, familyName }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirm !== familyName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.deleteFamily.error);
        return;
      }
      toast.success(t.deleteFamily.success);
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        {t.deleteFamily.trigger}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t.deleteFamily.title}
            </DialogTitle>
            <DialogDescription>
              {t.deleteFamily.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.deleteFamily.confirmHint(familyName).split(familyName).map((part, i, arr) =>
                i < arr.length - 1
                  ? <span key={i}>{part}<strong className="text-foreground">{familyName}</strong></span>
                  : <span key={i}>{part}</span>
              )}
            </p>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={familyName}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setConfirm(""); }}>
              {t.deleteFamily.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== familyName || loading}
              onClick={handleDelete}
            >
              {loading ? t.deleteFamily.deleting : t.deleteFamily.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
