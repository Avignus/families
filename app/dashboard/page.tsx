import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Users, AlertTriangle, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateFamilyDialog } from "@/components/family/create-family-dialog";
import { JoinFamilyDialog } from "@/components/family/join-family-dialog";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";

  const memberships = await prisma.familyMembership.findMany({
    where: { userId, status: "active" },
    include: {
      family: {
        include: {
          _count: {
            select: {
              memberships: { where: { status: "active" } },
              wishlistItems: { where: { status: { not: "cancelled" } } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const totalPendingRequests = await prisma.familyMembership.count({
    where: {
      family: { chiefId: userId },
      status: "pending",
    },
  });

  return (
    <div className="container py-8 space-y-6">
      {totalPendingRequests > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Você tem <strong>{totalPendingRequests}</strong> solicitação{totalPendingRequests > 1 ? "ões" : ""} de entrada pendente{totalPendingRequests > 1 ? "s" : ""}.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suas Famílias</h1>
        <div className="flex gap-2">
          <JoinFamilyDialog />
          <CreateFamilyDialog />
        </div>
      </div>

      {memberships.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(258 82% 60% / 0.12)", border: "1px solid hsl(258 82% 60% / 0.25)" }}>
              <Users className="h-8 w-8" style={{ color: "hsl(258 82% 66%)" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-base">Você ainda não tem famílias</p>
              <p className="text-sm text-muted-foreground">
                Crie uma família ou entre em uma existente pelo catálogo ou por ID.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <JoinFamilyDialog />
              <CreateFamilyDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ family }) => {
            const isChief = family.chiefId === userId;
            return (
              <Link key={family.id} href={`/families/${family.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{family.name}</CardTitle>
                      {isChief && (
                        <Badge variant="secondary" className="text-xs">Chefe</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {family._count.memberships} membro{family._count.memberships !== 1 ? "s" : ""}
                      </span>
                      <span>{family._count.wishlistItems} jogo{family._count.wishlistItems !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Moeda: {family.currency}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
