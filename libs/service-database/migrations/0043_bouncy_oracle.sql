CREATE TABLE "organization_limits" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"max_requests_per_minute_per_model" json,
	"max_tokens_per_minute_per_model" json
);
--> statement-breakpoint
ALTER TABLE "organization_limits" ADD CONSTRAINT "organization_limits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> create a organization_limits row for every organization
INSERT INTO "organization_limits" ("organization_id")
SELECT id FROM organizations;
