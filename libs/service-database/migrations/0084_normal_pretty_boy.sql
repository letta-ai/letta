CREATE TABLE "simulated_agent" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"agent_template_id" text NOT NULL,
	"deployed_agent_template_id" text,
	"variables" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulated_agent" ADD CONSTRAINT "simulated_agent_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent" ADD CONSTRAINT "simulated_agent_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent" ADD CONSTRAINT "simulated_agent_agent_template_id_agent_templates_id_fk" FOREIGN KEY ("agent_template_id") REFERENCES "public"."agent_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent" ADD CONSTRAINT "simulated_agent_deployed_agent_template_id_deployed_agent_templates_id_fk" FOREIGN KEY ("deployed_agent_template_id") REFERENCES "public"."deployed_agent_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_default_simulated_agent" ON "simulated_agent" USING btree ("agent_template_id","deployed_agent_template_id","is_default");
