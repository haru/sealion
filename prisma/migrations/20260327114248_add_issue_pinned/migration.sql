-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Issue_pinned_idx" ON "Issue"("pinned");
