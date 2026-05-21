-- AlterTable: add spotExpiresAt lease field to FamilyMembership
ALTER TABLE "FamilyMembership" ADD COLUMN "spotExpiresAt" TIMESTAMP(3);

-- CreateIndex: speed up cron expiration query
CREATE INDEX "FamilyMembership_spotExpiresAt_idx" ON "FamilyMembership"("spotExpiresAt");

-- AlterEnum: add SPOT_EXPIRING_SOON and SPOT_EXPIRED to NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_EXPIRING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_EXPIRED';
