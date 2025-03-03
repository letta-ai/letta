ALTER TABLE "organization_users" DROP CONSTRAINT "organization_users_id_users_id_fk";
ALTER TABLE "organization_users" ADD COLUMN "user_id" text;--> statement-breakpoint
--> set the user_id from id of organization_users
UPDATE "organization_users" SET "user_id" = "id";
--> statement-breakpoint
ALTER TABLE "organization_users" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "organization_users" DROP COLUMN IF EXISTS "id";


--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
