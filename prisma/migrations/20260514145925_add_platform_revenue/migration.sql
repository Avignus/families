-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformRevenue_reason_createdAt_idx" ON "PlatformRevenue"("reason", "createdAt");
