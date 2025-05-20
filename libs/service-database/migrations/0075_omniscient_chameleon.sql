CREATE TABLE "content_moderation_violations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"violation_reasons" json,
	"content" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_moderation_violations" ADD CONSTRAINT "content_moderation_violations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
