-- CreateTable Achievement
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "setSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateTable UserAchievement
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");
CREATE INDEX "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId", "unlockedAt");

-- CreateTable Cosmetic
CREATE TABLE "Cosmetic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cosmetic_slug_key" ON "Cosmetic"("slug");

-- CreateTable UserCosmetic
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticId_key" ON "UserCosmetic"("userId", "cosmeticId");
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- CreateTable EquippedCosmetics
CREATE TABLE "EquippedCosmetics" (
    "userId" TEXT NOT NULL,
    "avatarFrameId" TEXT,
    "profileBgId" TEXT,
    "nameTagId" TEXT,
    "cardEffectId" TEXT,
    CONSTRAINT "EquippedCosmetics_pkey" PRIMARY KEY ("userId")
);

-- CreateTable FamilyMemberPersonalization
CREATE TABLE "FamilyMemberPersonalization" (
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "coverThemeId" TEXT,
    CONSTRAINT "FamilyMemberPersonalization_pkey" PRIMARY KEY ("userId", "familyId")
);

-- AlterTable Family: add activeCoverThemeId
ALTER TABLE "Family" ADD COLUMN "activeCoverThemeId" TEXT;

-- AlterTable NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'ACHIEVEMENT_UNLOCKED';

-- AddForeignKey Achievement ← UserAchievement
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey"
    FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Cosmetic ← UserCosmetic
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey"
    FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Cosmetic ← EquippedCosmetics
ALTER TABLE "EquippedCosmetics" ADD CONSTRAINT "EquippedCosmetics_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquippedCosmetics" ADD CONSTRAINT "EquippedCosmetics_avatarFrameId_fkey"
    FOREIGN KEY ("avatarFrameId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquippedCosmetics" ADD CONSTRAINT "EquippedCosmetics_profileBgId_fkey"
    FOREIGN KEY ("profileBgId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquippedCosmetics" ADD CONSTRAINT "EquippedCosmetics_nameTagId_fkey"
    FOREIGN KEY ("nameTagId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquippedCosmetics" ADD CONSTRAINT "EquippedCosmetics_cardEffectId_fkey"
    FOREIGN KEY ("cardEffectId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Cosmetic ← Family (cover theme)
ALTER TABLE "Family" ADD CONSTRAINT "Family_activeCoverThemeId_fkey"
    FOREIGN KEY ("activeCoverThemeId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey FamilyMemberPersonalization
ALTER TABLE "FamilyMemberPersonalization" ADD CONSTRAINT "FamilyMemberPersonalization_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMemberPersonalization" ADD CONSTRAINT "FamilyMemberPersonalization_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMemberPersonalization" ADD CONSTRAINT "FamilyMemberPersonalization_coverThemeId_fkey"
    FOREIGN KEY ("coverThemeId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default cosmetics (always available cover themes)
INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
(gen_random_uuid(), 'capa-mosaico', 'Mosaico de Jogos', 'Mostra os jogos da wishlist da família', 'cover_theme', 'padrao', '{"variant":"mosaic"}', true),
(gen_random_uuid(), 'capa-gradiente', 'Gradiente do Clã', 'Gradiente sutil baseado na família', 'cover_theme', 'padrao', '{"variant":"gradient"}', true);

-- Seed achievement definitions
INSERT INTO "Achievement" ("id", "slug", "title", "description", "category", "rarity", "setSlug", "sortOrder") VALUES
-- TERROR SET
(gen_random_uuid(), 'colecionador-de-traumas', 'Colecionador de Traumas', 'Financiou 2 jogos de terror', 'terror', 'comum', 'terror', 1),
(gen_random_uuid(), 'dormiu-com-a-luz-acesa', 'Dormiu com a Luz Acesa', 'Financiou 5 jogos de terror', 'terror', 'incomum', 'terror', 2),
(gen_random_uuid(), 'nao-pode-assistir-mas-pode-comprar', 'Não Pode Assistir, Mas Pode Comprar', '10 jogos de terror na wishlist', 'terror', 'raro', 'terror', 3),
(gen_random_uuid(), 'senhor-das-trevas', 'Senhor das Trevas', 'Completou o set Terror — mestre do horror digital', 'terror', 'lendario', 'terror', 4),
-- GENEROSIDADE SET
(gen_random_uuid(), 'mecenas-da-dungeon', 'Mecenas da Dungeon', 'Realizou seu primeiro pledge', 'generosidade', 'comum', 'generosidade', 1),
(gen_random_uuid(), 'lancador-de-coin', 'Lançador de Coin', 'Completou 5 pledges', 'generosidade', 'comum', 'generosidade', 2),
(gen_random_uuid(), 'compra-tudo-nao-pode', 'Compra Tudo, Não Pode', 'Completou 10 pledges', 'generosidade', 'incomum', 'generosidade', 3),
(gen_random_uuid(), 'robin-hood-dos-pixels', 'Robin Hood dos Pixels', 'R$100 total em pledges', 'generosidade', 'incomum', 'generosidade', 4),
(gen_random_uuid(), 'o-tesouro-de-ganon', 'O Tesouro de Ganon', 'R$500 total em pledges', 'generosidade', 'raro', 'generosidade', 5),
(gen_random_uuid(), 'patrocinador-da-jogatina-alheia', 'Patrocinador da Jogatina Alheia', 'Completou o set Generosidade — lenda da plataforma', 'generosidade', 'lendario', 'generosidade', 6),
-- CO-OP SET
(gen_random_uuid(), 'sem-amigos-mas-com-coop', 'Sem Amigos, Mas Com Co-op', 'Primeiro jogo co-op financiado', 'coop', 'comum', 'coop', 1),
(gen_random_uuid(), 'elo-de-guilda', 'Elo de Guilda', '5 jogos co-op financiados', 'coop', 'incomum', 'coop', 2),
(gen_random_uuid(), 'a-familia-que-joga-unida', 'A Família Que Joga Unida...', 'Toda a família tem ao menos 1 jogo co-op', 'coop', 'raro', 'coop', 3),
(gen_random_uuid(), 'mestre-da-cooperacao', 'Mestre da Cooperação', 'Completou o set Co-op — alma do jogo em equipe', 'coop', 'lendario', 'coop', 4),
-- FAMÍLIA SET
(gen_random_uuid(), 'sem-casa-no-mapa', 'Sem Casa no Mapa', 'Criou sua primeira família', 'familia', 'comum', 'familia', 1),
(gen_random_uuid(), 'membro-honroso-do-cla', 'Membro Honroso do Clã', 'Ativo em uma família por 30 dias', 'familia', 'incomum', 'familia', 2),
(gen_random_uuid(), 'aquele-que-nao-sai-da-guilda', 'Aquele Que Não Sai da Guilda', '90 dias no mesmo clã', 'familia', 'raro', 'familia', 3),
(gen_random_uuid(), 'fundador-de-linhagem', 'Fundador de Linhagem', 'Chief com reputação máxima por 90 dias', 'familia', 'lendario', 'familia', 4),
-- COMPORTAMENTO
(gen_random_uuid(), 'pix-as-2-da-manha', 'Pix às 2 da Manhã', 'Realizou um pagamento entre meia-noite e 3h', 'comportamento', 'incomum', NULL, 1),
(gen_random_uuid(), 'sem-volta-agora', 'Sem Volta Agora', 'Comprou seu primeiro spot', 'comportamento', 'incomum', NULL, 2),
(gen_random_uuid(), 'confiavel-como-save', 'Confiável como Save', '10 pledges concluídos sem nenhum cancelado', 'comportamento', 'raro', NULL, 3);

-- Seed cosmetics granted by achievements
INSERT INTO "Cosmetic" ("id", "slug", "name", "description", "type", "rarity", "config", "isDefault") VALUES
-- TERROR SET cosmetics
(gen_random_uuid(), 'etiqueta-olhos-escuridao', 'Olhos na Escuridão', 'Dois olhos vermelhos piscando ao lado do nome', 'name_tag', 'comum', '{"animClass":"tag-horror","icon":"👁","color":"#dc2626"}', false),
(gen_random_uuid(), 'moldura-assombracao', 'A Assombração', 'Borda de névoa roxa com fantasma no canto', 'avatar_frame', 'incomum', '{"animClass":"frame-haunt","borderColor":"#7c3aed","glowColor":"#7c3aed","shadowIntensity":"high"}', false),
(gen_random_uuid(), 'bg-mansao-sombria', 'Mansão Sombria', 'Pedra escura com velas flutuantes e névoa rasteira', 'profile_bg', 'raro', '{"variant":"mansao-sombria","primaryColor":"#0d0015","accentColor":"#7c3aed","animClass":"bg-haunt"}', false),
(gen_random_uuid(), 'efeito-maldicao-ativa', 'Maldição Ativa', 'Partículas de cinza caindo sobre o card ao hover', 'card_effect', 'lendario', '{"animClass":"effect-curse","particleColor":"#7c3aed","intensity":"medium"}', false),
(gen_random_uuid(), 'capa-cripta-ancestral', 'Cripta Ancestral', 'Pedra ancestral com tochas animadas e névoa roxa', 'cover_theme', 'lendario', '{"variant":"cripta-ancestral","primaryColor":"#0d0015","accentColor":"#7c3aed","animClass":"theme-haunt"}', false),
-- GENEROSIDADE SET cosmetics
(gen_random_uuid(), 'etiqueta-moeda-giratoria', 'Moeda Giratória', 'Coin de ouro girando em loop', 'name_tag', 'comum', '{"animClass":"tag-spin","icon":"🪙","color":"#d97706"}', false),
(gen_random_uuid(), 'moldura-coroa-mecenas', 'Coroa do Mecenas', 'Coroa dourada no topo com joias pulsantes', 'avatar_frame', 'incomum', '{"animClass":"frame-gold","borderColor":"#f59e0b","glowColor":"#f59e0b","shadowIntensity":"medium"}', false),
(gen_random_uuid(), 'bg-sala-tesouro', 'Sala do Tesouro', 'Cofres dourados com moedas e luz âmbar', 'profile_bg', 'raro', '{"variant":"sala-tesouro","primaryColor":"#1a0e00","accentColor":"#f59e0b","animClass":"bg-gold"}', false),
(gen_random_uuid(), 'efeito-toque-midas', 'Toque de Midas', 'Card fica dourado ao hover com shimmer animado', 'card_effect', 'lendario', '{"animClass":"effect-gold","particleColor":"#f59e0b","intensity":"high"}', false),
(gen_random_uuid(), 'capa-sala-tesouro', 'Sala do Tesouro', 'Cofres e moedas douradas com luz âmbar vibrante', 'cover_theme', 'lendario', '{"variant":"sala-tesouro","primaryColor":"#1a0e00","accentColor":"#f59e0b","animClass":"theme-gold"}', false),
-- CO-OP SET cosmetics
(gen_random_uuid(), 'etiqueta-dois-controles', 'Dois Controles', 'Gamepads pulsando juntos', 'name_tag', 'comum', '{"animClass":"tag-pulse","icon":"🎮","color":"#10b981"}', false),
(gen_random_uuid(), 'moldura-corrente-cla', 'Corrente do Clã', 'Elos metálicos entrelaçados com brilho rotativo', 'avatar_frame', 'incomum', '{"animClass":"frame-chain","borderColor":"#10b981","glowColor":"#10b981","shadowIntensity":"medium"}', false),
(gen_random_uuid(), 'bg-fortaleza-cla', 'Fortaleza do Clã', 'Castelo épico ao entardecer com bandeiras tremulando', 'profile_bg', 'raro', '{"variant":"fortaleza-cla","primaryColor":"#0f2027","accentColor":"#10b981","animClass":"bg-fortress"}', false),
(gen_random_uuid(), 'efeito-sincronizado', 'Sincronizado', 'Card divide e une ao hover revelando conteúdo', 'card_effect', 'lendario', '{"animClass":"effect-sync","particleColor":"#10b981","intensity":"medium"}', false),
(gen_random_uuid(), 'capa-fortaleza-cla', 'Fortaleza do Clã', 'Vista épica de castelo ao entardecer com bandeiras', 'cover_theme', 'lendario', '{"variant":"fortaleza-cla","primaryColor":"#0f2027","accentColor":"#10b981","animClass":"theme-fortress"}', false),
-- COMPORTAMENTO cosmetics
(gen_random_uuid(), 'etiqueta-lua-carrinho', 'Lua com Carrinho', 'Lua sorrindo com carrinho de compras', 'name_tag', 'incomum', '{"animClass":"tag-float","icon":"🌙","color":"#6366f1"}', false),
(gen_random_uuid(), 'moldura-noite-compras', 'Noite de Compras', 'Skyline urbana à meia-noite com janelas animadas', 'avatar_frame', 'incomum', '{"animClass":"frame-neon","borderColor":"#6366f1","glowColor":"#818cf8","shadowIntensity":"high"}', false),
(gen_random_uuid(), 'capa-cidade-neon', 'Cidade Neon', 'Cyberpunk urbano com chuva animada e neon vibrante', 'cover_theme', 'incomum', '{"variant":"cidade-neon","primaryColor":"#0a0a1a","accentColor":"#818cf8","animClass":"theme-neon"}', false),
-- FAMÍLIA SET cosmetics
(gen_random_uuid(), 'etiqueta-escudo-familia', 'Escudo da Família', 'Brasão animado pulsando', 'name_tag', 'comum', '{"animClass":"tag-shield","icon":"🛡","color":"#0ea5e9"}', false),
(gen_random_uuid(), 'moldura-brasao-real', 'Brasão Real', 'Escudo heráldico com dragões nos cantos', 'avatar_frame', 'raro', '{"animClass":"frame-royal","borderColor":"#0ea5e9","glowColor":"#38bdf8","shadowIntensity":"high"}', false),
(gen_random_uuid(), 'capa-salao-trono', 'Salão do Trono', 'Corredor real com trono iluminado e tochas douradas', 'cover_theme', 'lendario', '{"variant":"salao-trono","primaryColor":"#0c0a09","accentColor":"#eab308","animClass":"theme-royal"}', false);
