-- Add email verification fields to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "isEmailVerified"    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerifyToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordResetToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);

-- Unique constraints on token columns
CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerifyToken_key"   ON "users"("emailVerifyToken");
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- Add vendorId / courierId to gifts
ALTER TABLE "gifts"
  ADD COLUMN IF NOT EXISTS "vendorId"  UUID,
  ADD COLUMN IF NOT EXISTS "courierId" UUID;

-- Add updatedAt to guests
ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Extend AuditAction enum with new values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REGISTRY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REGISTRY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GIFT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GIFT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_DELETED';

-- Add missing index on gifts.state
CREATE INDEX IF NOT EXISTS "gifts_state_idx" ON "gifts"("state");
