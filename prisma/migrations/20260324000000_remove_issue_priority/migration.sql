-- Remove priority column from Issue table
ALTER TABLE "Issue" DROP COLUMN "priority";

-- Drop IssuePriority enum
DROP TYPE "IssuePriority";
