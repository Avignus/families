-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AUTO_PLEDGED';

-- AlterTable
ALTER TABLE "FamilyMembership" ADD COLUMN     "lastAutoDistributedAt" TIMESTAMP(3),
ADD COLUMN     "monthlyBudgetCents" INTEGER NOT NULL DEFAULT 0;
