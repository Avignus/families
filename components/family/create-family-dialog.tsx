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

export function CreateFamilyDialog() {
  const router = useRouter();
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
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Erro ao criar família");
        return;
      }
      toast.success(`Família "${name}" criada!`);
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
          <Plus className="h-4 w-4" /> Criar Família
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Nova Família</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">Nome da família</label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Turma dos Games"
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
              Clique em <Shuffle className="h-3 w-3 inline" /> para sugerir um nome aleatório.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Criando..." : "Criar Família"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
