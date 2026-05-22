-- Add cover_video cosmetic type support

ALTER TABLE "Family" ADD COLUMN "activeCoverVideoId" TEXT REFERENCES "Cosmetic"("id") ON DELETE SET NULL;

ALTER TABLE "FamilyMemberPersonalization" ADD COLUMN "coverVideoId" TEXT REFERENCES "Cosmetic"("id") ON DELETE SET NULL;

-- Nebulosa Carmesim — video cosmetic (épico)
INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
(gen_random_uuid(), 'video-nebula', 'Nebulosa Carmesim',
 'Campo de estrelas em chamas renderizado em Blender. O card da sua família pulsa com vida no catálogo.',
 'cover_video', 'epico', '{"videoPath":"/effects/nebula.mp4"}', false);

-- Grant to all existing users on launch
INSERT INTO "UserCosmetic" ("id", "userId", "cosmeticId", "source", "unlockedAt")
SELECT gen_random_uuid(), u.id, c.id, 'launch', NOW()
FROM "User" u
CROSS JOIN "Cosmetic" c
WHERE c.slug = 'video-nebula'
ON CONFLICT ("userId", "cosmeticId") DO NOTHING;
