import { PrismaClient, MembershipStatus, WishlistStatus, PledgeStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create users
  const igor = await prisma.user.upsert({
    where: { steamId: "76561198000000001" },
    update: {},
    create: {
      steamId: "76561198000000001",
      personaName: "Igor",
      avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      avatarMedium: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg",
      avatarFull: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      profileUrl: "https://steamcommunity.com/id/igor",
    },
  });

  const joao = await prisma.user.upsert({
    where: { steamId: "76561198000000002" },
    update: {},
    create: {
      steamId: "76561198000000002",
      personaName: "João",
      avatarUrl: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_full.jpg",
      avatarMedium: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_medium.jpg",
      avatarFull: "https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef9e82e517e_full.jpg",
      profileUrl: "https://steamcommunity.com/id/joao",
    },
  });

  const maria = await prisma.user.upsert({
    where: { steamId: "76561198000000003" },
    update: {},
    create: {
      steamId: "76561198000000003",
      personaName: "Maria",
      avatarUrl: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_full.jpg",
      avatarMedium: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_medium.jpg",
      avatarFull: "https://avatars.steamstatic.com/c5d56249ee5d28a07db4ac9f7f60af961fab5ef8_full.jpg",
      profileUrl: "https://steamcommunity.com/id/maria",
    },
  });

  const pedro = await prisma.user.upsert({
    where: { steamId: "76561198000000004" },
    update: {},
    create: {
      steamId: "76561198000000004",
      personaName: "Pedro",
      avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      avatarMedium: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg",
      avatarFull: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      profileUrl: "https://steamcommunity.com/id/pedro",
    },
  });

  // Seed steam app catalog entries for demo
  await prisma.steamAppCatalog.upsert({
    where: { appId: 1145360 },
    update: {},
    create: { appId: 1145360, name: "Hades" },
  });
  await prisma.steamAppCatalog.upsert({
    where: { appId: 367520 },
    update: {},
    create: { appId: 367520, name: "Hollow Knight" },
  });
  await prisma.steamAppCatalog.upsert({
    where: { appId: 1086940 },
    update: {},
    create: { appId: 1086940, name: "Baldur's Gate 3" },
  });
  await prisma.steamAppCatalog.upsert({
    where: { appId: 1172470 },
    update: {},
    create: { appId: 1172470, name: "Apex Legends" },
  });

  // Seed app cache
  await prisma.steamAppCache.upsert({
    where: { steamAppId: 1145360 },
    update: {},
    create: {
      steamAppId: 1145360,
      payload: {
        appId: 1145360,
        name: "Hades",
        headerImage: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg",
        capsuleImage: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/capsule_616x353.jpg",
        priceCents: 3499,
        currency: "BRL",
        shortDescription: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.",
        isFree: false,
      },
    },
  });

  await prisma.steamAppCache.upsert({
    where: { steamAppId: 367520 },
    update: {},
    create: {
      steamAppId: 367520,
      payload: {
        appId: 367520,
        name: "Hollow Knight",
        headerImage: "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg",
        capsuleImage: "https://cdn.akamai.steamstatic.com/steam/apps/367520/capsule_616x353.jpg",
        priceCents: 2699,
        currency: "BRL",
        shortDescription: "Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes.",
        isFree: false,
      },
    },
  });

  await prisma.steamAppCache.upsert({
    where: { steamAppId: 1086940 },
    update: {},
    create: {
      steamAppId: 1086940,
      payload: {
        appId: 1086940,
        name: "Baldur's Gate 3",
        headerImage: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg",
        capsuleImage: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/capsule_616x353.jpg",
        priceCents: 24999,
        currency: "BRL",
        shortDescription: "Gather your party, and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival.",
        isFree: false,
      },
    },
  });

  // Create Family 1: "Turma dos Games"
  const family1 = await prisma.family.upsert({
    where: { id: "family-seed-1" },
    update: {},
    create: {
      id: "family-seed-1",
      name: "Turma dos Games",
      currency: "BRL",
      chiefId: igor.id,
    },
  });

  // Memberships for family 1
  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: igor.id, familyId: family1.id } },
    update: {},
    create: { userId: igor.id, familyId: family1.id, status: MembershipStatus.active },
  });
  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: joao.id, familyId: family1.id } },
    update: {},
    create: { userId: joao.id, familyId: family1.id, status: MembershipStatus.active },
  });
  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: maria.id, familyId: family1.id } },
    update: {},
    create: { userId: maria.id, familyId: family1.id, status: MembershipStatus.active },
  });

  // Create Family 2: "Indie Lovers"
  const family2 = await prisma.family.upsert({
    where: { id: "family-seed-2" },
    update: {},
    create: {
      id: "family-seed-2",
      name: "Indie Lovers",
      currency: "BRL",
      chiefId: joao.id,
    },
  });

  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: joao.id, familyId: family2.id } },
    update: {},
    create: { userId: joao.id, familyId: family2.id, status: MembershipStatus.active },
  });
  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: pedro.id, familyId: family2.id } },
    update: {},
    create: { userId: pedro.id, familyId: family2.id, status: MembershipStatus.active },
  });
  await prisma.familyMembership.upsert({
    where: { userId_familyId: { userId: igor.id, familyId: family2.id } },
    update: {},
    create: { userId: igor.id, familyId: family2.id, status: MembershipStatus.active },
  });

  // Wishlist items for family 1
  const item1 = await prisma.wishlistItem.upsert({
    where: { familyId_steamAppId: { familyId: family1.id, steamAppId: 1145360 } },
    update: {},
    create: {
      familyId: family1.id,
      ownerUserId: igor.id,
      steamAppId: 1145360,
      targetPriceCents: 3499,
      currency: "BRL",
      status: WishlistStatus.open,
    },
  });

  const item2 = await prisma.wishlistItem.upsert({
    where: { familyId_steamAppId: { familyId: family1.id, steamAppId: 367520 } },
    update: {},
    create: {
      familyId: family1.id,
      ownerUserId: joao.id,
      steamAppId: 367520,
      targetPriceCents: 2699,
      currency: "BRL",
      status: WishlistStatus.open,
    },
  });

  const item3 = await prisma.wishlistItem.upsert({
    where: { familyId_steamAppId: { familyId: family1.id, steamAppId: 1086940 } },
    update: {},
    create: {
      familyId: family1.id,
      ownerUserId: maria.id,
      steamAppId: 1086940,
      targetPriceCents: 24999,
      currency: "BRL",
      status: WishlistStatus.open,
    },
  });

  // Pledges
  await prisma.pledge.upsert({
    where: { id: "pledge-seed-1" },
    update: {},
    create: {
      id: "pledge-seed-1",
      wishlistItemId: item1.id,
      pledgerUserId: joao.id,
      amountCents: 1500,
      status: PledgeStatus.active,
    },
  });

  await prisma.pledge.upsert({
    where: { id: "pledge-seed-2" },
    update: {},
    create: {
      id: "pledge-seed-2",
      wishlistItemId: item1.id,
      pledgerUserId: maria.id,
      amountCents: 1000,
      status: PledgeStatus.active,
    },
  });

  await prisma.pledge.upsert({
    where: { id: "pledge-seed-3" },
    update: {},
    create: {
      id: "pledge-seed-3",
      wishlistItemId: item2.id,
      pledgerUserId: igor.id,
      amountCents: 2000,
      status: PledgeStatus.active,
    },
  });

  await prisma.pledge.upsert({
    where: { id: "pledge-seed-4" },
    update: {},
    create: {
      id: "pledge-seed-4",
      wishlistItemId: item3.id,
      pledgerUserId: igor.id,
      amountCents: 10000,
      status: PledgeStatus.active,
    },
  });

  await prisma.pledge.upsert({
    where: { id: "pledge-seed-5" },
    update: {},
    create: {
      id: "pledge-seed-5",
      wishlistItemId: item3.id,
      pledgerUserId: joao.id,
      amountCents: 8000,
      status: PledgeStatus.active,
    },
  });

  // Wishlist for family 2
  await prisma.wishlistItem.upsert({
    where: { familyId_steamAppId: { familyId: family2.id, steamAppId: 367520 } },
    update: {},
    create: {
      familyId: family2.id,
      ownerUserId: pedro.id,
      steamAppId: 367520,
      targetPriceCents: 2699,
      currency: "BRL",
      status: WishlistStatus.open,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
