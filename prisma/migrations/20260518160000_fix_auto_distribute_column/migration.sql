-- Fix: the migration 20260518152017 was committed as empty.
-- This migration adds the column that should have been created then.
ALTER TABLE "FamilyMembership" ADD COLUMN IF NOT EXISTS "autoDistributeEnabled" BOOLEAN NOT NULL DEFAULT false;
