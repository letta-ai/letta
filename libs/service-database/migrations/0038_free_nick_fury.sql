ALTER TABLE "letta_api_keys" ADD COLUMN "core_user_id" text;
--> set core_user_id to empty string for all rows
UPDATE "letta_api_keys" SET "core_user_id" = '';
--> set as not null
ALTER TABLE "letta_api_keys" ALTER COLUMN "core_user_id" SET NOT NULL;
