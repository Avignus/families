-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailPending" TEXT,
ADD COLUMN "emailVerifyToken" TEXT,
ADD COLUMN "emailVerifyExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");
