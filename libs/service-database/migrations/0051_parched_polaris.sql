CREATE TABLE "functional_migrations" (
	"single_id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployed_agents" ADD COLUMN "migrated_at" timestamp;
