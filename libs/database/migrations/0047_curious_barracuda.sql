CREATE TABLE "per_model_per_organization_rate_limit_overrides" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"max_requests_per_minute" numeric NOT NULL,
	"max_tokens_per_minute" numeric NOT NULL
);
--> statement-breakpoint
DROP TABLE "organization_limits" CASCADE;--> statement-breakpoint
ALTER TABLE "per_model_per_organization_rate_limit_overrides" ADD CONSTRAINT "per_model_per_organization_rate_limit_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_model_id" ON "per_model_per_organization_rate_limit_overrides" USING btree ("organization_id","model_id");
