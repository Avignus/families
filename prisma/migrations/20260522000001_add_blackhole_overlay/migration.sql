INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
(gen_random_uuid(), 'overlay-blackhole', 'Buraco Negro',
 'Disco de acreção, event horizon e névoa galáctica. O vácuo do espaço sobre a sua capa.',
 'cover_overlay', 'lendario', '{"cssClass":"cover-overlay-blackhole"}', false);

INSERT INTO "UserCosmetic" ("id", "userId", "cosmeticId", "source", "unlockedAt")
SELECT gen_random_uuid(), u.id, c.id, 'launch', NOW()
FROM "User" u
CROSS JOIN "Cosmetic" c
WHERE c.slug = 'overlay-blackhole'
ON CONFLICT ("userId", "cosmeticId") DO NOTHING;
