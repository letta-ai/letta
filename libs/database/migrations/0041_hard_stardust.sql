CREATE TABLE "organization_billing_details" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"billing_tier" text
);
--> statement-breakpoint
ALTER TABLE "organization_billing_details" ADD CONSTRAINT "organization_billing_details_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> add organization_billing_details to every existing organization
INSERT INTO "organization_billing_details" ("organization_id") SELECT "id" FROM "organizations";

--> add organization_credits to every existing organization if it doesn't exist
INSERT INTO "organization_credits" ("organization_id", "credits", "created_at", "updated_at")
SELECT "id", 0, now(), now()
FROM "organizations"
WHERE "id" NOT IN (SELECT "organization_id" FROM "organization_credits");
