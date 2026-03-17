-- Delete all unselected (disabled) projects before dropping the column
DELETE FROM "Project" WHERE "isEnabled" = false;

-- Drop the isEnabled column
ALTER TABLE "Project" DROP COLUMN "isEnabled";
