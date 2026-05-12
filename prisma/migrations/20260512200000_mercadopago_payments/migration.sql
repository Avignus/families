-- DropForeignKey
ALTER TABLE "PaymentProof" DROP CONSTRAINT IF EXISTS "PaymentProof_pledgeId_fkey";
ALTER TABLE "PaymentProof" DROP CONSTRAINT IF EXISTS "PaymentProof_uploadedBy_fkey";

-- DropTable
DROP TABLE IF EXISTS "PaymentProof";

-- DropEnum
DROP TYPE IF EXISTS "PaymentProofStatus";

-- AlterTable: add MercadoPago fields to Pledge
ALTER TABLE "Pledge"
  ADD COLUMN IF NOT EXISTS "mpPaymentId"    TEXT,
  ADD COLUMN IF NOT EXISTS "mpStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "mpQrCode"       TEXT,
  ADD COLUMN IF NOT EXISTS "mpQrCodeBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "mpTicketUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt"         TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_mpPaymentId_key" ON "Pledge"("mpPaymentId");
CREATE INDEX IF NOT EXISTS "Pledge_mpPaymentId_idx" ON "Pledge"("mpPaymentId");
