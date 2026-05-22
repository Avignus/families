import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RARITY_CONFIG } from "@/lib/cosmetics";
import { Trophy, Lock, Palette, Frame, Tag, Sparkles } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

const CATEGORY_LABELS: Record<string, string> = {
  terror:        "Terror",
  generosidade:  "Generosidade",
  coop:          "Co-op",
  familia:       "Família",
  comportamento: "Comportamento",
};

const COSMETIC_TYPE_ICON: Record<string, React.ReactNode> = {
  cover_theme:  <Palette className="h-3 w-3" />,
  avatar_frame: <Frame className="h-3 w-3" />,
  name_tag:     <Tag className="h-3 w-3" />,
  profile_bg:   <Sparkles className="h-3 w-3" />,
  card_effect:  <Sparkles className="h-3 w-3" />,
};

export default async function AchievementsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");
  const userId = (session.user as { id?: string }).id ?? "";

  const [allAchievements, userAchievements, userCosmetics] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    }),
    prisma.userCosmetic.findMany({
      where: { userId },
      include: { cosmetic: true },
      orderBy: { unlockedAt: "desc" },
    }),
  ]);

  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]));

  const byCategory = allAchievements.reduce<Record<string, typeof allAchievements>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  const totalUnlocked = userAchievements.length;
  const total = allAchievements.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" />
          Insígnias do Clã
        </h1>
        <p className="text-sm text-muted-foreground">
          {totalUnlocked} de {total} conquistas desbloqueadas
        </p>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden mt-2">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.round((totalUnlocked / total) * 100)}%` }}
          />
        </div>
      </div>

      {/* Cosmetics inventory */}
      {userCosmetics.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cosméticos desbloqueados
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {userCosmetics.map((uc) => {
              const rarity = RARITY_CONFIG[uc.cosmetic.rarity] ?? RARITY_CONFIG.comum;
              return (
                <div
                  key={uc.id}
                  className={`rounded-lg border border-border/40 bg-card/60 p-3 space-y-2 ${rarity.glow}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {uc.source ? (
                      <Image
                        src={`/badges/${uc.source}.png`}
                        alt={uc.source}
                        width={40}
                        height={40}
                        className="shrink-0 object-contain"
                      />
                    ) : (
                      <span className="text-muted-foreground mt-0.5">
                        {COSMETIC_TYPE_ICON[uc.cosmetic.type]}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${rarity.bg} ${rarity.color}`}>
                      {rarity.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-tight">{uc.cosmetic.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{uc.cosmetic.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements by category */}
      {Object.entries(byCategory).map(([category, achievements]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 pb-2">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="space-y-2">
            {achievements.map((a) => {
              const unlocked = unlockedMap.has(a.id);
              const unlockedAt = unlockedMap.get(a.id);
              const rarity = RARITY_CONFIG[a.rarity] ?? RARITY_CONFIG.comum;
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    unlocked
                      ? `border-border/60 bg-card/80 ${rarity.glow}`
                      : "border-border/20 bg-card/20 opacity-50"
                  }`}
                >
                  <div className="mt-0.5 shrink-0 relative h-12 w-12">
                    <Image
                      src={`/badges/${a.slug}.png`}
                      alt={a.title}
                      width={48}
                      height={48}
                      className={`h-12 w-12 object-contain transition-all ${
                        unlocked ? "" : "grayscale opacity-30"
                      }`}
                    />
                    {!unlocked && (
                      <Lock className="absolute bottom-0 right-0 h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold leading-tight">{a.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${rarity.bg} ${rarity.color}`}>
                        {rarity.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    {unlocked && unlockedAt && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Desbloqueada em {new Date(unlockedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
