import Image from "next/image";
import { Users } from "lucide-react";

type Props = {
  family: { name: string; description: string | null; coverImageUrl: string | null } | null;
};

export function FamilyGuestView({ family }: Props) {
  if (!family) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <p className="text-muted-foreground">Família não encontrada.</p>
        <a href="/" className="text-sm text-primary underline underline-offset-4">Ir para o início</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 max-w-md mx-auto text-center">
      {family.coverImageUrl ? (
        <div className="relative w-full h-36 rounded-xl overflow-hidden">
          <Image src={family.coverImageUrl} alt={family.name} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold font-display">{family.name}</h1>
        {family.description && (
          <p className="text-sm text-muted-foreground">{family.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Entre com sua conta Steam para ver esta família.
        </p>
      </div>

      <a
        href="/"
        className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Entrar com Steam
      </a>
    </div>
  );
}
