ALTER TABLE "source_agents" ADD COLUMN "testing_agent_id_uuid" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "source_agents" DROP COLUMN IF EXISTS "testing_agent_id";--> statement-breakpoint
ALTER TABLE "source_agents_statistics" DROP COLUMN IF EXISTS "deployed_agent_count";
