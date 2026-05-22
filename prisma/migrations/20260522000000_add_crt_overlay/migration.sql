INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
(gen_random_uuid(), 'overlay-crt', 'TV de Tubo',
 'Scanlines, feixe de elétrons e flicker de fósforo. Traz o charme do CRT.',
 'cover_overlay', 'raro', '{"cssClass":"cover-overlay-crt"}', false);

INSERT INTO "UserCosmetic" ("id", "userId", "cosmeticId", "source", "unlockedAt")
SELECT gen_random_uuid(), u.id, c.id, 'launch', NOW()
FROM "User" u
CROSS JOIN "Cosmetic" c
WHERE c.slug = 'overlay-crt'
ON CONFLICT ("userId", "cosmeticId") DO NOTHING;
