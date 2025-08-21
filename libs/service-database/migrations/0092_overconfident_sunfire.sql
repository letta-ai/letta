ALTER TABLE "letta_api_keys" DROP CONSTRAINT "letta_api_keys_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "letta_api_keys" ALTER COLUMN "user_id" DROP NOT NULL;
