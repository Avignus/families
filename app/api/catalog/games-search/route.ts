import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { searchAppCatalog } from "@/lib/steam";
import { prisma } from "@/lib/prisma";

const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY ?? "BR";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (!q || q.length < 2) return ok([]);

  const localApps = await searchAppCatalog(q, 20);

  if (localApps.length > 0) {
    const cachedApps = await prisma.steamAppCache.findMany({
      where: { steamAppId: { in: localApps.map((a) => a.appId) } },
    });
    const cacheMap = new Map(cachedApps.map((c) => [c.steamAppId, c.payload as Record<string, unknown>]));

    return ok(localApps.map((app) => {
      const cached = cacheMap.get(app.appId);
      return {
        appId: app.appId,
        name: app.name,
        headerImage: (cached?.headerImage as string) ??
          `https://cdn.akamai.steamstatic.com/steam/apps/${app.appId}/header.jpg`,
      };
    }));
  }

  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=${DEFAULT_COUNTRY}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return ok([]);

    const data = await res.json();
    const items = data.items ?? [];

    await Promise.all(
      items.map((item: { id: number; name: string }) =>
        prisma.steamAppCatalog.upsert({
          where: { appId: item.id },
          update: { name: item.name },
          create: { appId: item.id, name: item.name },
        })
      )
    );

    return ok(
      items.map((item: { id: number; name: string; tiny_image?: string }) => ({
        appId: item.id,
        name: item.name,
        headerImage:
          item.tiny_image ??
          `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`,
      }))
    );
  } catch {
    return ok([]);
  }
}
