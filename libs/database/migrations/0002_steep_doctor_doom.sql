DO $$ BEGIN
 CREATE TYPE "public"."source_agents_enum" AS ENUM('live', 'offline');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_agent_status_table" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "source_agents_enum" NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_agents" ADD COLUMN "version" text NOT NULL;--> statement-breakpoint
ALTER TABLE "letta_api_keys" DROP COLUMN IF EXISTS "salt";--> statement-breakpoint
ALTER TABLE "source_agents" ADD CONSTRAINT "source_agents_version_unique" UNIQUE("version");