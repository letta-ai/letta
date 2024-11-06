ALTER TABLE "users" RENAME COLUMN "organization_id" TO "active_organization_id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_organizations_id_fk";
