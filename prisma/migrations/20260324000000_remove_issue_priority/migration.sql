-- Remove priority column from Issue table
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "priority";

-- Drop IssuePriority enum
DROP TYPE IF EXISTS "IssuePriority";
