ALTER TABLE "organization_users" ADD COLUMN "custom_permissions" json;--> statement-breakpoint
ALTER TABLE "organization_users" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "organization_users" DROP COLUMN "permissions";
