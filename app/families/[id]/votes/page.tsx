import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VotesPanel } from "@/components/votes/votes-panel";

export default async function VotesPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";

  const [family, membership] = await Promise.all([
    prisma.family.findUnique({ where: { id: params.id } }),
    prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId: params.id } },
    }),
  ]);

  if (!family || !membership || membership.status !== "active") redirect("/dashboard");

  return (
    <div className="container py-8 max-w-2xl space-y-6">
      <Link href={`/families/${params.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para {family.name}
      </Link>
      <h1 className="text-2xl font-bold">Votações — {family.name}</h1>
      <VotesPanel familyId={params.id} currency={family.currency} />
    </div>
  );
}
