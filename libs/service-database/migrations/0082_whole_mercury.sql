ALTER TABLE "agentfile_permissions" ADD COLUMN "name" text ;--> statement-breakpoint
ALTER TABLE "agentfile_permissions" ADD COLUMN "description" text ;
--> give existing agentfile_permissions a default name and description
UPDATE "agentfile_permissions"
SET "name" = 'generic-agentfile',
    "description" = 'Default Description'
WHERE "name" IS NULL OR "description" IS NULL;
-- --> statement-breakpoint
ALTER TABLE "agentfile_permissions" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "agentfile_permissions" ALTER COLUMN "description" SET NOT NULL;
