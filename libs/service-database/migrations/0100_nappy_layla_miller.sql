CREATE TABLE "auto_top_up_credits_configuration" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"threshold" integer NOT NULL,
	"refill_amount" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "auto_top_up_credits_configuration_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "auto_top_up_credits_configuration" ADD CONSTRAINT "auto_top_up_credits_configuration_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
