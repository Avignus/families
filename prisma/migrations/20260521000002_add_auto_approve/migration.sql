-- AlterTable: add autoApprove to Family
ALTER TABLE "Family" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum: add JOIN_PAYMENT_AWAITING_APPROVAL to NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'JOIN_PAYMENT_AWAITING_APPROVAL';
