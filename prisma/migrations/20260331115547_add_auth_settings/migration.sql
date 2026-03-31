-- CreateTable
CREATE TABLE "AuthSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "allowUserSignup" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeoutMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSettings_pkey" PRIMARY KEY ("id")
);
