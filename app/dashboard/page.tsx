import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";

  const membership = await prisma.familyMembership.findFirst({
    where: { userId, status: "active" },
    select: { familyId: true },
  });

  if (membership) redirect(`/families/${membership.familyId}`);
  redirect("/catalog");
}
