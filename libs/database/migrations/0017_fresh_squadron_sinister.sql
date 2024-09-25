ALTER TABLE "organizations" ADD COLUMN "letta_agents_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_letta_agents_id_unique" UNIQUE("letta_agents_id");
ALTER TABLE "source_agents" DROP CONSTRAINT "source_agents_version_unique" UNIQUE("version");
