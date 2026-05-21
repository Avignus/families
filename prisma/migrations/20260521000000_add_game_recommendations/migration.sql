-- CreateTable
CREATE TABLE "GameRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "familyId" TEXT,
    "type" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "gameName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameRecommendation_userId_generatedAt_idx" ON "GameRecommendation"("userId", "generatedAt");

-- CreateIndex
CREATE INDEX "GameRecommendation_familyId_generatedAt_idx" ON "GameRecommendation"("familyId", "generatedAt");

-- AddForeignKey
ALTER TABLE "GameRecommendation" ADD CONSTRAINT "GameRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRecommendation" ADD CONSTRAINT "GameRecommendation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
