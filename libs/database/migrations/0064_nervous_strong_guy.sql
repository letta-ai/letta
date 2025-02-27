CREATE TABLE "deployed_agent_metadata" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text
);
--> for every deployed_agent_variables create a row in deployed_agent_metadata
INSERT INTO "deployed_agent_metadata" ("agent_id", "organization_id") SELECT DISTINCT "deployed_agent_id", "organization_id" FROM "deployed_agent_variables";

--> statement-breakpoint
ALTER TABLE "deployed_agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "deployed_agents" CASCADE;--> statement-breakpoint
ALTER TABLE "deployed_agent_metadata" ADD CONSTRAINT "deployed_agent_metadata_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployed_agent_metadata" ADD CONSTRAINT "deployed_agent_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployed_agent_variables" ADD CONSTRAINT "deployed_agent_variables_deployed_agent_id_deployed_agent_metadata_agent_id_fk" FOREIGN KEY ("deployed_agent_id") REFERENCES "public"."deployed_agent_metadata"("agent_id") ON DELETE cascade ON UPDATE no action;
