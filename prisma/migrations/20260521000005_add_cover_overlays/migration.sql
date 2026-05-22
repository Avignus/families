-- Add cover_overlay type support: Family and FamilyMemberPersonalization
-- get independent overlay slots separate from the cover theme.

ALTER TABLE "Family" ADD COLUMN "activeCoverOverlayId" TEXT;
ALTER TABLE "FamilyMemberPersonalization" ADD COLUMN "coverOverlayId" TEXT;

ALTER TABLE "Family" ADD CONSTRAINT "Family_activeCoverOverlayId_fkey"
    FOREIGN KEY ("activeCoverOverlayId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FamilyMemberPersonalization" ADD CONSTRAINT "FamilyMemberPersonalization_coverOverlayId_fkey"
    FOREIGN KEY ("coverOverlayId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed overlay cosmetics
INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
(gen_random_uuid(), 'overlay-nevoa-rasteira',    'Névoa Rasteira',     'Névoa roxa flutuando pelo chão',                'cover_overlay', 'incomum', '{"cssClass":"cover-overlay-mist"}',    false),
(gen_random_uuid(), 'overlay-shimmer-dourado',   'Shimmer Dourado',    'Luz dourada varrendo a capa em diagonal',       'cover_overlay', 'incomum', '{"cssClass":"cover-overlay-shimmer"}', false),
(gen_random_uuid(), 'overlay-bandeiras',         'Bandeiras ao Vento', 'Brilho verde oscilando como bandeiras ao vento','cover_overlay', 'incomum', '{"cssClass":"cover-overlay-flags"}',   false),
(gen_random_uuid(), 'overlay-chuva-neon',        'Chuva Neon',         'Linhas de chuva roxas em queda contínua',      'cover_overlay', 'incomum', '{"cssClass":"cover-overlay-rain"}',    false),
(gen_random_uuid(), 'overlay-radiancia-real',    'Radiância Real',     'Pulso de luz dourada vinda de baixo',           'cover_overlay', 'raro',    '{"cssClass":"cover-overlay-radiance"}',false),
(gen_random_uuid(), 'overlay-chama-violeta',     'Chama Violeta',      'Labaredas roxas pulsando nas bordas',           'cover_overlay', 'raro',    '{"cssClass":"cover-overlay-flame"}',   false),
(gen_random_uuid(), 'overlay-scanner',           'Scanner',            'Linha de scan horizontal deslizando',           'cover_overlay', 'raro',    '{"cssClass":"cover-overlay-scanner"}', false);

-- Grant all overlays to all current users (retroactive)
INSERT INTO "UserCosmetic" ("id", "userId", "cosmeticId", "source", "unlockedAt")
SELECT gen_random_uuid(), u.id, c.id, 'admin-unlock', NOW()
FROM "User" u
CROSS JOIN "Cosmetic" c
WHERE c.type = 'cover_overlay'
ON CONFLICT ("userId", "cosmeticId") DO NOTHING;
