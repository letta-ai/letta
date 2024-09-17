ALTER TABLE "deployed_agents" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "source_agents" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "deployed_agents" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "source_agents" DROP COLUMN IF EXISTS "name";