-- AlterTable: add spot terms acceptance timestamp to FamilyMembership
ALTER TABLE "FamilyMembership" ADD COLUMN "spotTermsAcceptedAt" TIMESTAMP(3);

-- AlterEnum: add spot removal refund notification type
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_REMOVED_REFUND';
