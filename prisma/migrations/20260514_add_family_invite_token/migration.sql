ALTER TABLE "Family" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "Family_inviteToken_key" ON "Family"("inviteToken");
