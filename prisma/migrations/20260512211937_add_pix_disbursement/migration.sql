-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DISBURSEMENT_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'PIX_KEY_REQUIRED';

-- AlterTable
ALTER TABLE "Pledge" ADD COLUMN     "mpAmountCents" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pixKey" TEXT;

-- AlterTable
ALTER TABLE "WishlistItem" ADD COLUMN     "disbursedAt" TIMESTAMP(3),
ADD COLUMN     "disbursementMpId" TEXT;
