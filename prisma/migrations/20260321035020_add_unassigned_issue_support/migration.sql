-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "isUnassigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "includeUnassigned" BOOLEAN NOT NULL DEFAULT false;
