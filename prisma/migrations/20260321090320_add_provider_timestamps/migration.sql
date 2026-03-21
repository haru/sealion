-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "providerCreatedAt" TIMESTAMP(3),
ADD COLUMN     "providerUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Issue_dueDate_providerUpdatedAt_providerCreatedAt_idx" ON "Issue"("dueDate", "providerUpdatedAt", "providerCreatedAt");
