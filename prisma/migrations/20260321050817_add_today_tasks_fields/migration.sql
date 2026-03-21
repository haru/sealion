-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "todayAddedAt" TIMESTAMP(3),
ADD COLUMN     "todayFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "todayOrder" INTEGER;

-- CreateIndex
CREATE INDEX "Issue_todayFlag_todayOrder_idx" ON "Issue"("todayFlag", "todayOrder");
