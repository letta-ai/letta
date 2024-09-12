CREATE TABLE IF NOT EXISTS "source_agents_statistics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deployed_agent_count" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_agents_statistics" ADD CONSTRAINT "source_agents_statistics_id_source_agents_id_fk" FOREIGN KEY ("id") REFERENCES "public"."source_agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployed_agents_statistics" ADD CONSTRAINT "deployed_agents_statistics_id_deployed_agents_id_fk" FOREIGN KEY ("id") REFERENCES "public"."deployed_agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_agent_status_table" ADD CONSTRAINT "source_agent_status_table_id_source_agents_id_fk" FOREIGN KEY ("id") REFERENCES "public"."source_agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
