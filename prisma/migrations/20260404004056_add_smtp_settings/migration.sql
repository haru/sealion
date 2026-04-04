-- CreateTable
CREATE TABLE "SmtpSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT 'Sealion',
    "requireAuth" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "encryptedPassword" TEXT,
    "useTls" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpSettings_pkey" PRIMARY KEY ("id")
);
