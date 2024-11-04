CREATE TABLE IF NOT EXISTS "invited_users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "invited_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_simulator_sessions" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_templates" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "deployed_agent_templates" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "deployed_agents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "letta_api_keys" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invited_users" ADD CONSTRAINT "invited_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
