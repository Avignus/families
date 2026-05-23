-- Rename MercadoPago legacy field names to Pix/Asaas names

-- FamilyMembership
ALTER TABLE "FamilyMembership" RENAME COLUMN "mpPaymentId" TO "pixPaymentId";
ALTER TABLE "FamilyMembership" RENAME COLUMN "mpStatus" TO "pixStatus";
ALTER TABLE "FamilyMembership" RENAME COLUMN "mpQrCode" TO "pixQrCode";
ALTER TABLE "FamilyMembership" RENAME COLUMN "mpQrCodeBase64" TO "pixQrCodeBase64";
ALTER TABLE "FamilyMembership" RENAME COLUMN "mpTicketUrl" TO "pixTicketUrl";

-- WishlistItem
ALTER TABLE "WishlistItem" RENAME COLUMN "disbursementMpId" TO "disbursementId";

-- Pledge
ALTER TABLE "Pledge" RENAME COLUMN "mpPaymentId" TO "pixPaymentId";
ALTER TABLE "Pledge" RENAME COLUMN "mpAmountCents" TO "pixAmountCents";
ALTER TABLE "Pledge" RENAME COLUMN "mpStatus" TO "pixStatus";
ALTER TABLE "Pledge" RENAME COLUMN "mpQrCode" TO "pixQrCode";
ALTER TABLE "Pledge" RENAME COLUMN "mpQrCodeBase64" TO "pixQrCodeBase64";
ALTER TABLE "Pledge" RENAME COLUMN "mpTicketUrl" TO "pixTicketUrl";

-- Rename indexes
ALTER INDEX IF EXISTS "Pledge_mpPaymentId_idx" RENAME TO "Pledge_pixPaymentId_idx";
ALTER INDEX IF EXISTS "FamilyMembership_mpPaymentId_key" RENAME TO "FamilyMembership_pixPaymentId_key";
