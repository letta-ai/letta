CREATE TABLE IF NOT EXISTS "development_server_passwords" (
	"development_server_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "development_server_passwords" ADD CONSTRAINT "development_server_passwords_development_server_id_development_servers_id_fk" FOREIGN KEY ("development_server_id") REFERENCES "public"."development_servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "development_server_passwords" ADD CONSTRAINT "development_server_passwords_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
