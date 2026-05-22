import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? "");

export type RecommendedGame = { name: string; steamAppId: number; reason: string };

function parseJsonResponse(text: string): RecommendedGame[] {
  const clean = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
  return parsed.filter(
    (item): item is RecommendedGame =>
      typeof item === "object" &&
      typeof item.name === "string" &&
      typeof item.steamAppId === "number" &&
      typeof item.reason === "string"
  );
}

export async function recommendGamesForUser(
  ownedGames: Array<{ name: string; playtimeMinutes: number }>,
  exclude: string[] = []
): Promise<RecommendedGame[]> {
  if (!process.env.GOOGLE_API_KEY) return [];

  const topGames = [...ownedGames]
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, 30)
    .map((g) => `- ${g.name} (${Math.round(g.playtimeMinutes / 60)}h)`);

  const excludeSection = exclude.length > 0
    ? `\nDo NOT recommend any of these already-recommended games:\n${exclude.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  const prompt = `You are a Steam game recommendation expert. Given a player's game library with playtime, recommend games they would enjoy that they don't already own.

Player's top games by playtime:
${topGames.join("\n")}
${excludeSection}
Return EXACTLY 8 recommendations as a JSON array with the correct Steam App ID for each game.
Format: [{"name": "Exact Steam Store Name", "steamAppId": 123456, "reason": "1-2 sentence explanation in Portuguese (pt-BR)"}]

Rules:
- Only recommend games currently available on Steam
- Do not recommend any games the player already owns
- steamAppId must be the real numeric Steam App ID (e.g. Hollow Knight = 367520, Terraria = 105600)
- Write the reason in Portuguese (pt-BR)

Return ONLY the JSON array, no other text.`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return parseJsonResponse(result.response.text());
}

export async function recommendGamesForFamily(
  wishlistGames: string[],
  exclude: string[] = []
): Promise<RecommendedGame[]> {
  if (!process.env.GOOGLE_API_KEY) return [];

  const excludeSection = exclude.length > 0
    ? `\nDo NOT recommend any of these already-recommended games:\n${exclude.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  const prompt = `You are a Steam game recommendation expert. Given a gaming group's shared wishlist, recommend additional games they would enjoy together.

Family wishlist:
${wishlistGames.map((g) => `- ${g}`).join("\n")}
${excludeSection}
Return EXACTLY 8 recommendations as a JSON array with the correct Steam App ID for each game.
Format: [{"name": "Exact Steam Store Name", "steamAppId": 123456, "reason": "1-2 sentence explanation in Portuguese (pt-BR)"}]

Rules:
- Only recommend games currently available on Steam
- Do not recommend any games already on the wishlist
- steamAppId must be the real numeric Steam App ID (e.g. Hollow Knight = 367520, Terraria = 105600)
- Write the reason in Portuguese (pt-BR)
- Prioritize games that work well for groups

Return ONLY the JSON array, no other text.`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return parseJsonResponse(result.response.text());
}
