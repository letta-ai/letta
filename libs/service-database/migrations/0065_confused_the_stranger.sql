CREATE TABLE "share_chat_identity" (
	"identity_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_chat_user" (
	"user_id" text,
	"chat_id" text NOT NULL,
	"deployed_agent_id" text NOT NULL,
	"identity_id" text NOT NULL,
	"agent_template_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_chat_user_user_id_chat_id_deployed_agent_id_pk" PRIMARY KEY("user_id","chat_id","deployed_agent_id")
);
--> statement-breakpoint
ALTER TABLE "deployed_agent_templates" ADD COLUMN "memory_variables" json;--> statement-breakpoint
ALTER TABLE "shared_agent_chat_configurations" ADD COLUMN "launch_link_id" text;--> statement-breakpoint
ALTER TABLE "share_chat_identity" ADD CONSTRAINT "share_chat_identity_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_identity" ADD CONSTRAINT "share_chat_identity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_user" ADD CONSTRAINT "share_chat_user_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_user" ADD CONSTRAINT "share_chat_user_chat_id_shared_agent_chat_configurations_access_url_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."shared_agent_chat_configurations"("access_url") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_user" ADD CONSTRAINT "share_chat_user_deployed_agent_id_deployed_agent_metadata_agent_id_fk" FOREIGN KEY ("deployed_agent_id") REFERENCES "public"."deployed_agent_metadata"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_user" ADD CONSTRAINT "share_chat_user_identity_id_share_chat_identity_identity_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."share_chat_identity"("identity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_chat_user" ADD CONSTRAINT "share_chat_user_agent_template_id_agent_templates_id_fk" FOREIGN KEY ("agent_template_id") REFERENCES "public"."agent_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_agent_chat_configurations" ADD CONSTRAINT "shared_agent_chat_configurations_launch_link_id_launch_link_configurations_agent_template_id_fk" FOREIGN KEY ("launch_link_id") REFERENCES "public"."launch_link_configurations"("agent_template_id") ON DELETE cascade ON UPDATE no action;
