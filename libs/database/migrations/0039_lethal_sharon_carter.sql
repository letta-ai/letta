CREATE TYPE "public"."transaction_types" AS ENUM('addition', 'subtraction');--> statement-breakpoint
CREATE TABLE "organization_credit_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"transaction_type" "transaction_types" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_credits" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"credits" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_credit_transactions" ADD CONSTRAINT "organization_credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_credits" ADD CONSTRAINT "organization_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> create a organization_credits row for each organization and give them 0 credits
INSERT INTO "organization_credits" ("organization_id", "credits", "created_at", "updated_at")
SELECT "id", 0, now(), now()
FROM "organizations";
