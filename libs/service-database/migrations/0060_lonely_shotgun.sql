CREATE TABLE "organization_sso_configuration" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"workos_organization_id" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_sso_configuration_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "organization_sso_configuration" ADD CONSTRAINT "organization_sso_configuration_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
