-- AlterTable
ALTER TABLE "GameRecommendation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'cron';
ALTER TABLE "GameRecommendation" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "GameRecommendation_userId_source_generatedAt_idx" ON "GameRecommendation"("userId", "source", "generatedAt");
