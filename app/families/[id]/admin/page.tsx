import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { JoinRequestActions } from "@/components/family/join-request-actions";
import { MemberActions } from "@/components/family/member-actions";
import { CatalogSettingsForm } from "@/components/family/catalog-settings-form";
import { ReputationBadge } from "@/components/reputation-badge";
import { ArrowLeft, Crown, Users, Globe } from "lucide-react";
import Link from "next/link";

export default async function AdminPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      chief: { select: { personaName: true, avatarMedium: true, avatarUrl: true } },
      memberships: {
        where: { status: { in: ["active", "pending"] } },
        include: { user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true, reputationScore: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!family) redirect("/dashboard");
  if (family.chiefId !== userId) redirect(`/families/${params.id}`);

  const pendingRequests = family.memberships.filter((m) => m.status === "pending");
  const activeMembers = family.memberships.filter((m) => m.status === "active");

  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <Link href={`/families/${params.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para {family.name}
      </Link>

      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-400" />
        Administrar: {family.name}
      </h1>

      {/* Pending join requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Solicitações Pendentes
            {pendingRequests.length > 0 && (
              <Badge>{pendingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={m.user.avatarMedium} />
                      <AvatarFallback>{m.user.personaName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{m.user.personaName}</p>
                        <ReputationBadge score={m.user.reputationScore} showScore />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <JoinRequestActions familyId={params.id} requestId={m.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membros Ativos ({activeMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.user.avatarMedium} />
                    <AvatarFallback>{m.user.personaName[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{m.user.personaName}</p>
                      {m.userId === family.chiefId && (
                        <Badge variant="secondary" className="text-xs">Chefe</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Desde {new Date(m.joinedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {m.userId !== userId && (
                  <MemberActions familyId={params.id} memberId={m.userId} memberName={m.user.personaName} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Catalog settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Catálogo Público
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogSettingsForm
            familyId={params.id}
            familyName={family.name}
            chiefName={family.chief.personaName}
            chiefAvatar={family.chief.avatarMedium || family.chief.avatarUrl}
            initial={{
              isPublic: family.isPublic,
              description: family.description,
              maxMembers: family.maxMembers,
              entryFeeCents: family.entryFeeCents,
              currency: family.currency,
              memberCount: activeMembers.length,
            }}
          />
        </CardContent>
      </Card>

      {/* Family ID share */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-1">ID da Família</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-secondary px-2 py-1 rounded flex-1 truncate">{params.id}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compartilhe este ID para que outras pessoas possam solicitar entrada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
