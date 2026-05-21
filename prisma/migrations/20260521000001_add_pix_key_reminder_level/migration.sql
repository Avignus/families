-- Add missing column that was added to schema without a migration
ALTER TABLE "WishlistItem" ADD COLUMN IF NOT EXISTS "pixKeyReminderLevel" INTEGER NOT NULL DEFAULT 0;
