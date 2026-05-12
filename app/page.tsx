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
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
              </svg>
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
