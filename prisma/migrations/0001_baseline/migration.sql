-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOST', 'GUEST', 'VENDOR', 'COURIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GiftState" AS ENUM ('PENDING', 'FUNDED', 'PURCHASED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'FUNDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'REGISTRY_CREATED', 'GIFT_CREATED', 'CONTRIBUTION_CREATED', 'CONTRIBUTION_FUNDED', 'GIFT_STATE_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registries" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" UUID NOT NULL,
    "registryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetAmountKzt" DECIMAL(12,2) NOT NULL,
    "currentAmountKzt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requiredTierRank" INTEGER NOT NULL DEFAULT 0,
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "state" "GiftState" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "registryId" UUID NOT NULL,
    "userId" UUID,
    "parentId" UUID,
    "displayName" TEXT NOT NULL,
    "kinshipLabel" TEXT NOT NULL,
    "tierRank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" UUID NOT NULL,
    "giftId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "amountKzt" DECIMAL(12,2) NOT NULL,
    "amountOriginal" DECIMAL(12,2) NOT NULL,
    "currencyOriginal" CHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(14,6) NOT NULL,
    "rateLockedAt" TIMESTAMP(3) NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "registries_hostId_idx" ON "registries"("hostId");

-- CreateIndex
CREATE INDEX "gifts_registryId_state_idx" ON "gifts"("registryId", "state");

-- CreateIndex
CREATE INDEX "guests_registryId_idx" ON "guests"("registryId");

-- CreateIndex
CREATE INDEX "guests_parentId_idx" ON "guests"("parentId");

-- CreateIndex
CREATE INDEX "guests_registryId_tierRank_idx" ON "guests"("registryId", "tierRank");

-- CreateIndex
CREATE INDEX "contributions_giftId_status_idx" ON "contributions"("giftId", "status");

-- CreateIndex
CREATE INDEX "contributions_giftId_createdAt_idx" ON "contributions"("giftId", "createdAt");

-- CreateIndex
CREATE INDEX "contributions_rateLockedAt_idx" ON "contributions"("rateLockedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registries" ADD CONSTRAINT "registries_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 1. A guest's parent must belong to the same registry as the guest. (SKIPPED: Subqueries not allowed in CHECK constraints)

-- 2. A gift may never be over-funded. The application also checks this inside
-- a Serializable transaction; this CHECK is the final defense.
ALTER TABLE "gifts"
  ADD CONSTRAINT "gifts_no_overfund" CHECK ("currentAmountKzt" <= "targetAmountKzt");

-- 3. Partial unique index: a guest cannot have two simultaneous PENDING
-- contributions to the same gift. Defense-in-depth against double-submit
-- when the client retries on a slow network.
CREATE UNIQUE INDEX "contributions_one_pending_per_guest_gift"
  ON "contributions" ("giftId", "guestId")
  WHERE "status" = 'PENDING';