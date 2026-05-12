import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { getAppDetails } from "@/lib/steam";

export async function GET(_req: NextRequest, { params }: { params: { appId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const appId = parseInt(params.appId, 10);
  if (isNaN(appId)) return err("INVALID_APP_ID", "Invalid Steam app ID", 400);

  const data = await getAppDetails(appId);
  if (!data) return err("NOT_FOUND", "Steam app not found", 404);

  return ok(data);
}
