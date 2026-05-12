"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";

type Props = { familyId: string; memberId: string; memberName: string };

export function MemberActions({ familyId, memberId, memberName }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao remover membro");
        return;
      }
      toast.success(`${memberName} removido da família`);
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <UserMinus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {memberName}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso cancelará todas as contribuições ativas de {memberName} nesta família. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading}>
              {loading ? "Removendo..." : "Remover Membro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
