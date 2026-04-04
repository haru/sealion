-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterTable: add status column with default ACTIVE
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- Migrate data: users with isActive = false become SUSPENDED
UPDATE "User" SET status = 'SUSPENDED' WHERE "isActive" = false;

-- AlterTable: add email verification token columns
ALTER TABLE "User" ADD COLUMN "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenExpires" TIMESTAMP(3);

-- CreateIndex: unique constraint on emailVerificationToken
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- Drop old isActive column
ALTER TABLE "User" DROP COLUMN "isActive";

-- AlterTable: add requireEmailVerification to AuthSettings
ALTER TABLE "AuthSettings" ADD COLUMN "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false;
