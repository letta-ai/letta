CREATE TABLE IF NOT EXISTS "user_marketing_details" (
	"user_id" text PRIMARY KEY NOT NULL,
	"use_cases" json,
	"reasons" json,
	"consented_to_emails_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "submitted_onboarding_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_marketing_details" ADD CONSTRAINT "user_marketing_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
