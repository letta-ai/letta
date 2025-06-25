ALTER TABLE "agentfile_permissions" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agentfile_permissions" ADD CONSTRAINT "agentfile_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
