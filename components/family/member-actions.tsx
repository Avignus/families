"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserMinus, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Props = {
  familyId: string;
  memberId: string;
  memberName: string;
  compact?: boolean;
  onSuccess?: () => void;
};

export function MemberActions({ familyId, memberId, memberName, compact = false, onSuccess }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${memberId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.memberActions.error);
        return;
      }
      toast.success(t.memberActions.success(memberName));
      setConfirmOpen(false);
      setReason("");
      if (onSuccess) onSuccess();
      else router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const trigger = compact ? (
    <button
      onClick={() => setConfirmOpen(true)}
      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border border-border/60 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors opacity-0 group-hover/member:opacity-100 shadow-sm"
      title={t.memberActions.title(memberName)}
    >
      <X className="h-3 w-3" />
    </button>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirmOpen(true)}
    >
      <UserMinus className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <>
      {trigger}

      <Dialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.memberActions.title(memberName)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.memberActions.desc(memberName)}
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.memberActions.reason}</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.memberActions.reasonPlaceholder}
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setReason(""); }}>
              {t.memberActions.cancel}
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading}>
              {loading ? t.memberActions.removing : t.memberActions.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
