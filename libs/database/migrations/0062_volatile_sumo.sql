CREATE TABLE "launch_link_configurations" (
	"organization_id" text NOT NULL,
	"agent_template_id" text PRIMARY KEY NOT NULL,
	"access_policy" "chat_access" NOT NULL,
	"launch_link" text NOT NULL,
	CONSTRAINT "launch_link_configurations_agent_template_id_unique" UNIQUE("agent_template_id"),
	CONSTRAINT "launch_link_configurations_launch_link_unique" UNIQUE("launch_link")
);
--> statement-breakpoint
ALTER TABLE "launch_link_configurations" ADD CONSTRAINT "launch_link_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_link_configurations" ADD CONSTRAINT "launch_link_configurations_agent_template_id_agent_templates_id_fk" FOREIGN KEY ("agent_template_id") REFERENCES "public"."agent_templates"("id") ON DELETE cascade ON UPDATE no action;
