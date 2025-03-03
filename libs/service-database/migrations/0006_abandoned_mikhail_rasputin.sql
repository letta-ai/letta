ALTER TABLE "agent_simulator_sessions" ADD COLUMN "organization_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_simulator_sessions" ADD CONSTRAINT "agent_simulator_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
