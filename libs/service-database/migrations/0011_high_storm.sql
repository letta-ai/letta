CREATE TABLE IF NOT EXISTS "organization_users" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"permissions" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invited_users" RENAME TO "organization_invites";--> statement-breakpoint
ALTER TABLE "organization_invites" DROP CONSTRAINT "invited_users_email_unique";--> statement-breakpoint
ALTER TABLE "organization_invites" DROP CONSTRAINT "invited_users_organization_id_organizations_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_email_unique" UNIQUE("email");
--> statement-breakpoint
--> Create a row of organization_users for every user in an organization
DO $$
DECLARE
  user_row RECORD;
  organization_id TEXT;
BEGIN
    FOR user_row IN SELECT id, active_organization_id FROM users
    LOOP
        INSERT INTO organization_users (id, organization_id, permissions, created_at, updated_at)
        VALUES (user_row.id, user_row.active_organization_id, '{ "isOrganizationAdmin": true }', now(), now());
    END LOOP;
END $$;
