-- AlterTable: add spot verification & escrow fields to FamilyMembership
ALTER TABLE "FamilyMembership" ADD COLUMN "spotVerifStatus" TEXT,
                               ADD COLUMN "spotVerifDeadline" TIMESTAMP(3),
                               ADD COLUMN "spotVerifImageUrl" TEXT,
                               ADD COLUMN "spotVerifNotes" TEXT,
                               ADD COLUMN "spotEscrowCents" INTEGER;

-- AlterEnum: add spot verification notification types
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_VERIFICATION_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'SPOT_VERIFICATION_EXPIRED';
