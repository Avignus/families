-- Add spotMaxPriceCents ceiling to Family model (default R$249)
ALTER TABLE "Family" ADD COLUMN "spotMaxPriceCents" INTEGER NOT NULL DEFAULT 24900;
