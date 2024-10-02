ALTER TABLE "deployed_agent_templates" DROP COLUMN IF EXISTS "key";--> statement-breakpoint
ALTER TABLE "deployed_agents" DROP COLUMN IF EXISTS "deployed_agent_template_key";