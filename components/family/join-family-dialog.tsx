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

export function JoinFamilyDialog() {
  const router = useRouter();
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
        toast.error(data.error?.message ?? "Erro ao solicitar entrada");
        return;
      }
      toast.success("Solicitação enviada! Aguarde a aprovação do chefe.");
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
          <LogIn className="h-4 w-4" /> Entre em uma família
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em uma Família</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">ID da família</label>
            <Input
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              placeholder="Cole o ID da família aqui"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Peça o ID ao chefe da família que deseja entrar.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !familyId.trim()}>
              {loading ? "Enviando..." : "Solicitar Entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
