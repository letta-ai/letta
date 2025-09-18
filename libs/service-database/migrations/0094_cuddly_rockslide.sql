ALTER TABLE "deployed_agent_metadata" ADD COLUMN "deployment_id" text;--> statement-breakpoint
ALTER TABLE "deployed_agent_variables" ADD COLUMN "deployment_id" text;--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD COLUMN "deployment_id" text;