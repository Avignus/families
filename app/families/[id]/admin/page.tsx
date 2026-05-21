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
import { DeleteFamilyButton } from "@/components/family/delete-family-button";
import { InviteLinkPanel } from "@/components/family/invite-link-panel";
import { ArrowLeft, Crown, Users, Globe, Link2 } from "lucide-react";
import { FamilyTierBadge } from "@/components/family-tier-badge";
import { WithdrawPanel } from "@/components/family/withdraw-panel";
import Link from "next/link";
import { getServerTranslations } from "@/lib/i18n/server";

export default async function AdminPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      chief: { select: { personaName: true, avatarMedium: true, avatarUrl: true, pixKey: true } },
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
  const { t } = getServerTranslations();

  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <Link href={`/families/${params.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.admin.back(family.name)}
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-400" />
          {t.admin.title(family.name)}
        </h1>
        <FamilyTierBadge score={family.familyScore} size="md" showScore />
      </div>

      {/* Pending join requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {t.admin.pendingRequests}
            {pendingRequests.length > 0 && (
              <Badge>{pendingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.admin.noPending}</p>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{m.user.personaName}</p>
                        <ReputationBadge score={m.user.reputationScore} showScore />
                        {m.feePaidAt && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            {t.admin.feePaid}
                          </span>
                        )}
                        {!m.feePaidAt && m.feeChargedCents && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            {t.admin.waitingPayment}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString(t.dateLocale)}
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
            {t.admin.activeMembers(activeMembers.length)}
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
                        <Badge variant="secondary" className="text-xs">{t.admin.chief}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.admin.since(new Date(m.joinedAt).toLocaleDateString(t.dateLocale))}
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
            {t.admin.publicCatalog}
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
              spotPricingEnabled: family.spotPricingEnabled,
              spotFraction: family.spotFraction,
              spotMinPriceCents: family.spotMinPriceCents,
              autoApprove: family.autoApprove,
            }}
            chiefHasPixKey={!!family.chief.pixKey}
          />
        </CardContent>
      </Card>

      {/* Invite link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {t.admin.inviteLink}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InviteLinkPanel
            familyId={params.id}
            initialToken={family.inviteToken ?? null}
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? ""}
          />
        </CardContent>
      </Card>

      {/* Spot earnings withdrawal */}
      <WithdrawPanel hasPixKey={!!family.chief.pixKey} />

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">{t.admin.dangerZone}</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteFamilyButton familyId={params.id} familyName={family.name} />
        </CardContent>
      </Card>
    </div>
  );
}
