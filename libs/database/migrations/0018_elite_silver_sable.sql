CREATE TABLE IF NOT EXISTS "ade_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_config" json NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ade_preferences" ADD CONSTRAINT "ade_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
