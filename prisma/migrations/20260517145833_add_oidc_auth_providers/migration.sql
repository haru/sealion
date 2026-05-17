-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('OIDC_GENERIC', 'GOOGLE', 'GITHUB', 'MICROSOFT_ENTRA');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthProvider" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "AuthProviderType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "issuerUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthProvider_providerId_key" ON "AuthProvider"("providerId");

-- CreateIndex
CREATE INDEX "AuthProvider_enabled_idx" ON "AuthProvider"("enabled");
