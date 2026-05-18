"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Props = { familyId: string; requestId: string };

export function JoinRequestActions({ familyId, requestId }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const handle = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests/${requestId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro");
        return;
      }
      toast.success(action === "approve" ? t.family.memberApproved : t.family.requestRejected);
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
        onClick={() => handle("reject")}
        disabled={loading !== null}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        className="h-8"
        onClick={() => handle("approve")}
        disabled={loading !== null}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
