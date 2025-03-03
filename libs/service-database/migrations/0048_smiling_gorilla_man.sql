CREATE TYPE "public"."pricing_model_enum" AS ENUM('prepay', 'cpm');--> statement-breakpoint
ALTER TABLE "organization_billing_details" ADD COLUMN "pricing_model" "pricing_model_enum";--> statement-breakpoint
ALTER TABLE "organization_billing_details" ADD COLUMN "monthly_credit_allocation" numeric;
--> set existing pricing_model to 'prepay'
UPDATE "organization_billing_details" SET "pricing_model" = 'prepay';
--> set pricing_model to not null
ALTER TABLE "organization_billing_details" ALTER COLUMN "pricing_model" SET NOT NULL;
CREATE TABLE "organization_billing_details_audit" (
                                                    "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                                                    "organization_id" text NOT NULL,
                                                    "monthly_credit_allocation" numeric,
                                                    "pricing_model" "pricing_model_enum" NOT NULL,
                                                    "billing_tier" text,
                                                    "updated_by" text NOT NULL,
                                                    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_billing_details_audit" ADD CONSTRAINT "organization_billing_details_audit_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
