import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Users, Crown, Lock, Unlock, ArrowLeft, Zap } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FamilyCoverArt } from "@/components/family-cover-art";
import { JoinViaInviteButton } from "@/components/family/join-via-invite-button";
import Link from "next/link";
import { getServerTranslations } from "@/lib/i18n/server";
import { calculateSpotPrice } from "@/lib/spot-price";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const family = await prisma.family.findUnique({
    where: { inviteToken: params.token },
    include: {
      chief: { select: { personaName: true, avatarMedium: true, avatarUrl: true } },
      _count: { select: { memberships: { where: { status: "active" } } } },
    },
  });

  if (!family) notFound();

  const memberCount = family._count.memberships;
  const isFull = family.maxMembers ? memberCount >= family.maxMembers : false;

  // Already a member → go straight to family page
  if (currentUserId) {
    const membership = await prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId: currentUserId, familyId: family.id } },
      select: { status: true },
    });
    if (membership?.status === "active") {
      redirect(`/families/${family.id}`);
    }
  }

  // Compute personalized spot price for logged-in non-members
  let spotPriceCents: number | null = null;
  if (family.spotPricingEnabled && currentUserId) {
    const spotResult = await calculateSpotPrice(family.id, currentUserId).catch(() => null);
    spotPriceCents = spotResult?.spotPriceCents ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const loginUrl = `/api/auth/steam?callbackUrl=${encodeURIComponent(`/join/${params.token}`)}`;
  const { t } = getServerTranslations();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Card */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          {/* Cover */}
          <div className="h-28 w-full overflow-hidden">
            <FamilyCoverArt familyId={family.id} />
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.join.invitedTo}</p>
              <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {family.name}
              </h1>
              {family.description && (
                <p className="text-sm text-muted-foreground mt-1">{family.description}</p>
              )}
            </div>

            {/* Chief */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarImage src={family.chief.avatarMedium || family.chief.avatarUrl} />
                <AvatarFallback className="text-xs">{family.chief.personaName[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate">{family.chief.personaName}</span>
              <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                {t.join.members(memberCount, family.maxMembers)}
              </span>
              {family.spotPricingEnabled ? (
                spotPriceCents !== null ? (
                  spotPriceCents > 0 ? (
                    <span className="flex items-center gap-1 text-primary font-semibold">
                      <Zap className="h-3.5 w-3.5" />
                      {formatCurrency(spotPriceCents, family.currency)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Unlock className="h-3.5 w-3.5" /> {t.join.free}
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <Zap className="h-3.5 w-3.5" /> Spot
                  </span>
                )
              ) : family.entryFeeCents > 0 ? (
                <span className="font-semibold text-primary">
                  {formatCurrency(family.entryFeeCents, family.currency)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Unlock className="h-3.5 w-3.5" /> {t.join.free}
                </span>
              )}
            </div>

            {isFull ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-1">
                <Lock className="h-4 w-4" /> {t.join.noSlots}
              </div>
            ) : !currentUserId ? (
              <a
                href={loginUrl}
                className="flex items-center justify-center gap-3 w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
                </svg>
                {t.join.loginBtn}
              </a>
            ) : (
              <JoinViaInviteButton
                familyId={family.id}
                familyName={family.name}
                entryFeeCents={family.entryFeeCents}
                currency={family.currency}
                spotPricingEnabled={family.spotPricingEnabled}
                spotPriceCents={spotPriceCents}
              />
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t.join.disclaimer}{" "}
          <Link href="/terms" className="underline underline-offset-2">{t.join.termsLink}</Link>.
        </p>
      </div>
    </div>
  );
}
