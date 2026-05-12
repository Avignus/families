import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6 border border-primary/20">
              <Users className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Families
          </h1>
          <p className="text-lg text-muted-foreground">
            Junte-se com amigos e família para financiar jogos da Steam na lista de desejos uns dos outros.
          </p>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            <span>Contribua para jogos na lista de desejos de amigos</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            <span>Acompanhe o progresso em tempo real</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            <span>Vote em compras compartilhadas com a família</span>
          </div>
        </div>

        <div className="pt-4">
          <Link href="/api/auth/steam">
            <button
              className="flex items-center gap-3 mx-auto bg-[#1b2838] hover:bg-[#2a475e] border border-[#4c6b22] text-white px-6 py-3 rounded-md transition-colors font-medium"
            >
              <img
                src="/images/sits_01.png"
                alt="Steam"
                className="h-6 w-6"
              />
              Entrar com Steam
            </button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Autenticação segura via Steam OpenID 2.0
          </p>
        </div>

        <div className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            <strong>Aviso:</strong> As contribuições são apenas registros contábeis.
            As compras reais acontecem no Steam e são responsabilidade dos membros.
            Não há movimentação financeira real neste app.
          </p>
        </div>
      </div>
    </div>
  );
}
