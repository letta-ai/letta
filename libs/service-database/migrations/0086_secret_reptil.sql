CREATE TABLE "simulated_agent_real" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"agent_template_id" text NOT NULL,
	"deployed_agent_template_id" text,
	"memory_variables" json,
	"variables" json NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "simulated_agent_real_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
DROP TABLE "simulated_agent" CASCADE;--> statement-breakpoint
ALTER TABLE "simulated_agent_real" ADD CONSTRAINT "simulated_agent_real_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_real" ADD CONSTRAINT "simulated_agent_real_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_real" ADD CONSTRAINT "simulated_agent_real_agent_template_id_agent_templates_id_fk" FOREIGN KEY ("agent_template_id") REFERENCES "public"."agent_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_real" ADD CONSTRAINT "simulated_agent_real_deployed_agent_template_id_deployed_agent_templates_id_fk" FOREIGN KEY ("deployed_agent_template_id") REFERENCES "public"."deployed_agent_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_default_simulated_agent" ON "simulated_agent_real" USING btree ("agent_template_id","deployed_agent_template_id","is_default");


-- Migrate existing agentSimulatorSessions to simulatedAgent
-- Get projectId directly from the agentTemplates table
INSERT INTO "simulated_agent_real" (
  "agent_id",
  "project_id",
  "organization_id",
  "is_default",
  "agent_template_id",
  "deployed_agent_template_id",
  "variables",
  "created_at",
  "updated_at"
)
SELECT
  ass.agent_id,
  at.project_id,
  ass.organization_id,
  true as is_default,
  ass.agent_template_id,
  NULL as deployed_agent_template_id,
  ass.variables,
  ass.created_at,
  ass.updated_at
FROM agent_simulator_sessions ass
       INNER JOIN agent_templates at ON ass.agent_template_id = at.id
WHERE ass.deleted_at IS NULL
  AND at.deleted_at IS NULL
  AND NOT EXISTS (
-- Avoid duplicates if simulatedAgent already has this agentId
  SELECT 1 FROM simulated_agent_real sa WHERE sa.agent_id = ass.agent_id
);
