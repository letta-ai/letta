CREATE TABLE "organization_low_balance_notification_lock" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"lock_id" text NOT NULL,
	"low_balance_notification_sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "organization_low_balance_notification_lock" ADD CONSTRAINT "organization_low_balance_notification_lock_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
