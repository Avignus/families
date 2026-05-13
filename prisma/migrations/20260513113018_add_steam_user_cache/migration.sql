-- CreateTable
CREATE TABLE "SteamUserCache" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamUserCache_pkey" PRIMARY KEY ("userId","type")
);

-- CreateIndex
CREATE INDEX "SteamUserCache_fetchedAt_idx" ON "SteamUserCache"("fetchedAt");
