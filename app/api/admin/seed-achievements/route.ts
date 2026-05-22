import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NEW_COSMETICS = [
  {
    slug: "video-nebula",
    name: "Nebulosa Carmesim",
    type: "cover_overlay",
    rarity: "epico",
    description: "Campo de estrelas em chamas renderizado em Blender. O card da sua família pulsa com vida no catálogo.",
    config: { cssClass: "cover-overlay-nebula" },
  },
];

const NEW_ACHIEVEMENTS = [
  // Overlay achievements
  { slug: "olhos-nas-trevas",     title: "Olhos nas Trevas",      description: "O medo começa com o que você coloca na lista.",                      category: "terror",        rarity: "incomum",  sortOrder: 5 },
  { slug: "chama-das-sombras",    title: "Chama das Sombras",     description: "Você rega o terror dos outros com prazer.",                          category: "terror",        rarity: "raro",     sortOrder: 6 },
  { slug: "brilho-do-mecenas",    title: "Brilho do Mecenas",     description: "Ouro não falta para quem acredita nos outros.",                      category: "generosidade",  rarity: "incomum",  sortOrder: 7 },
  { slug: "explorador-das-estrelas", title: "Explorador das Estrelas", description: "Você alcançou as fronteiras do catálogo intergaláctico.",        category: "generosidade",  rarity: "epico",    sortOrder: 8 },
  { slug: "cacador-de-coop",      title: "Caçador de Co-op",      description: "Você escaneou a biblioteca e encontrou parceiros.",                  category: "coop",          rarity: "raro",     sortOrder: 5 },
  { slug: "bandeira-do-cla",      title: "Bandeira do Clã",       description: "Sua família cresceu o suficiente para mostrar orgulho.",             category: "familia",       rarity: "incomum",  sortOrder: 5 },
  { slug: "soberano-da-linhagem", title: "Soberano da Linhagem",  description: "Uma coroa não se usa, se conquista com lealdade.",                   category: "familia",       rarity: "raro",     sortOrder: 6 },
  { slug: "noturno-inveterado",   title: "Noturno Inveterado",    description: "Três vezes a madrugada te viu gastando.",                            category: "comportamento", rarity: "incomum",  sortOrder: 4 },
  { slug: "reliquia-retro",       title: "Relíquia Retrô",        description: "Dois meses de lealdade. Você é praticamente uma instituição.",        category: "comportamento", rarity: "raro",     sortOrder: 5 },
  { slug: "singularidade",        title: "Singularidade",         description: "Você absorveu tudo. Não há mais nada além do horizonte de eventos.", category: "comportamento", rarity: "lendario", sortOrder: 6 },
];

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cosmeticsResult = await Promise.all(
    NEW_COSMETICS.map((c) =>
      prisma.cosmetic.upsert({ where: { slug: c.slug }, update: {}, create: c })
    )
  );

  const achievementsResult = await Promise.all(
    NEW_ACHIEVEMENTS.map((a) =>
      prisma.achievement.upsert({ where: { slug: a.slug }, update: {}, create: a })
    )
  );

  return NextResponse.json({
    ok: true,
    cosmetics: cosmeticsResult.length,
    achievements: achievementsResult.length,
  });
}
