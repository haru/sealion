/*
  Warnings:

  - You are about to drop the column `status` on the `Issue` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Issue_status_dueDate_idx";

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "status";

-- DropEnum
DROP TYPE "IssueStatus";

-- CreateIndex
CREATE INDEX "Issue_dueDate_idx" ON "Issue"("dueDate");
