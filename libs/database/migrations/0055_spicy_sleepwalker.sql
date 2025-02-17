CREATE TYPE "public"."chat_access" AS ENUM('restricted', 'organization', 'logged-in', 'everyone');--> statement-breakpoint
CREATE TABLE "shared_agent_chat_configurations" (
	"organization_id" text NOT NULL,
	"agent_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"access_level" "chat_access" NOT NULL,
	"access_url" text NOT NULL,
	CONSTRAINT "shared_agent_chat_configurations_agent_id_unique" UNIQUE("agent_id"),
	CONSTRAINT "shared_agent_chat_configurations_access_url_unique" UNIQUE("access_url")
);
--> statement-breakpoint
ALTER TABLE "shared_agent_chat_configurations" ADD CONSTRAINT "shared_agent_chat_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_agent_chat_configurations" ADD CONSTRAINT "shared_agent_chat_configurations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
