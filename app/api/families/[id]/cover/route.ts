import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id }, select: { chiefId: true, coverImageUrl: true } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can change the cover", 403);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return err("VALIDATION_ERROR", "No file provided", 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return err("VALIDATION_ERROR", "Formato não suportado. Use JPG, PNG, WEBP ou GIF.", 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return err("VALIDATION_ERROR", "Imagem muito grande. Máximo 5 MB.", 400);
  }

  // Delete previous blob if exists
  if (family.coverImageUrl) {
    try { await del(family.coverImageUrl); } catch { /* ignore if already gone */ }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return err("CONFIGURATION_ERROR", "Blob storage não configurado. Configure BLOB_READ_WRITE_TOKEN no projeto Vercel.", 503);
  }

  const blob = await put(`family-covers/${params.id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.family.update({
    where: { id: params.id },
    data: { coverImageUrl: blob.url },
  });

  return ok({ coverImageUrl: blob.url });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id }, select: { chiefId: true, coverImageUrl: true } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can change the cover", 403);

  if (family.coverImageUrl) {
    try { await del(family.coverImageUrl); } catch { /* ignore */ }
    await prisma.family.update({ where: { id: params.id }, data: { coverImageUrl: null } });
  }

  return ok({ coverImageUrl: null });
}
