ALTER TABLE "agentfile_permissions" ADD COLUMN "summary" text;

-- Backfill existing rows with empty strings for summary column
UPDATE "agentfile_permissions" SET "summary" = '' WHERE "summary" IS NULL;

-- Alter the column to be NOT NULL
ALTER TABLE "agentfile_permissions" ALTER COLUMN "summary" SET NOT NULL;
