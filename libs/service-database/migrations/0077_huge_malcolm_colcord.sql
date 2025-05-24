CREATE TABLE "active_agents" (
	"organization_id" text NOT NULL,
	"agent_id" text PRIMARY KEY NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"is_billed_agent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_agents" ADD CONSTRAINT "active_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
