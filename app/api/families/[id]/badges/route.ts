import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const RARITY_ORDER: Record<string, number> = {
  lendario: 4,
  raro: 3,
  incomum: 2,
  comum: 1,
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });

  const { id: familyId } = params;

  const memberships = await prisma.familyMembership.findMany({
    where: { familyId, status: "active" },
    select: {
      user: {
        select: {
          id: true,
          personaName: true,
          avatarMedium: true,
          userAchievements: {
            select: {
              achievement: {
                select: { id: true, slug: true, title: true, description: true, rarity: true, category: true },
              },
            },
          },
        },
      },
    },
  });

  // Aggregate by achievement
  const map = new Map<string, {
    achievementId: string;
    slug: string;
    title: string;
    description: string;
    rarity: string;
    category: string;
    members: Array<{ userId: string; personaName: string; avatarMedium: string }>;
  }>();

  for (const { user } of memberships) {
    for (const { achievement: a } of user.userAchievements) {
      if (!map.has(a.id)) {
        map.set(a.id, {
          achievementId: a.id,
          slug: a.slug,
          title: a.title,
          description: a.description,
          rarity: a.rarity,
          category: a.category,
          members: [],
        });
      }
      map.get(a.id)!.members.push({
        userId: user.id,
        personaName: user.personaName,
        avatarMedium: user.avatarMedium,
      });
    }
  }

  const badges = [...map.values()].sort((a, b) => {
    const rd = (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
    return rd !== 0 ? rd : b.members.length - a.members.length;
  });

  return NextResponse.json({ data: { badges } });
}
