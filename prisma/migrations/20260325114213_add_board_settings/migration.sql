-- CreateTable
CREATE TABLE "BoardSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showCreatedAt" BOOLEAN NOT NULL DEFAULT true,
    "showUpdatedAt" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" JSONB NOT NULL DEFAULT '["dueDate_asc","providerUpdatedAt_desc"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardSettings_userId_key" ON "BoardSettings"("userId");

-- AddForeignKey
ALTER TABLE "BoardSettings" ADD CONSTRAINT "BoardSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
