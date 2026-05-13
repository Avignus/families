/*
  Warnings:

  - A unique constraint covering the columns `[mpPaymentId]` on the table `FamilyMembership` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'JOIN_FEE_PAID';

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "description" TEXT,
ADD COLUMN     "entryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxMembers" INTEGER;

-- AlterTable
ALTER TABLE "FamilyMembership" ADD COLUMN     "feePaidAt" TIMESTAMP(3),
ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpQrCode" TEXT,
ADD COLUMN     "mpQrCodeBase64" TEXT,
ADD COLUMN     "mpStatus" TEXT,
ADD COLUMN     "mpTicketUrl" TEXT;

-- CreateIndex
CREATE INDEX "Family_isPublic_idx" ON "Family"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_mpPaymentId_key" ON "FamilyMembership"("mpPaymentId");
