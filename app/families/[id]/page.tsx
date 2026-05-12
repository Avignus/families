import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FamilyPageClient } from "@/components/family/family-page-client";

export default async function FamilyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  return <FamilyPageClient familyId={params.id} />;
}
