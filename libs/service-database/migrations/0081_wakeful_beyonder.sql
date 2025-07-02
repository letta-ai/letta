CREATE TABLE "agentfile_stats" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"total_downloads" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentfile_stats" ADD CONSTRAINT "agentfile_stats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

--> create an agentfile_stats row for each existing agentfile_permissions
INSERT INTO "agentfile_stats" ("agent_id", "organization_id")
SELECT "agent_id", "organization_id"
FROM "agentfile_permissions"
ON CONFLICT ("agent_id") DO NOTHING;
