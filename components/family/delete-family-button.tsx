"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
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
        toast.error(data.error?.message ?? "Erro ao excluir família");
        return;
      }
      toast.success("Família excluída.");
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
        Excluir família
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir família
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os membros, jogos, contribuições e votações serão perdidos permanentemente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite <strong className="text-foreground">{familyName}</strong> para confirmar:
            </p>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={familyName}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setConfirm(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== familyName || loading}
              onClick={handleDelete}
            >
              {loading ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
