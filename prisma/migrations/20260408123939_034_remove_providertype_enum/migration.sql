-- AlterTable
ALTER TABLE "IssueProvider"
ALTER COLUMN "type" TYPE TEXT USING "type"::text;

-- DropEnum
DROP TYPE "ProviderType";
