CREATE TYPE "public"."deployment_status_enum" AS ENUM('initiated', 'failed', 'ready', 'migrating');--> statement-breakpoint
CREATE TABLE "deployment" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"letta_template_id" text NOT NULL,
	"status" "deployment_status_enum" DEFAULT 'initiated' NOT NULL,
	"status_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
