CREATE TABLE IF NOT EXISTS "deployed_agent_variables" (
	"deployed_agent_id" text PRIMARY KEY NOT NULL,
	"value" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployed_agents" ADD COLUMN "root_agent_template_id" text;--> statement-breakpoint
--> Loop through all deployed agents and set the root_agent_template_id by looking up the deployed_agent_template_id in the deployed_agent_templates table and looking up the agent_template_id
--> in the agent_templates table. If the agent_template_id is not found, set the root_agent_template_id to null.
DO $$ DECLARE
  deployed_agent_row RECORD;
  agent_template_id text;
  deployed_agent_template_id text;
  root_agent_template_id_value text;
BEGIN
  FOR deployed_agent_row IN SELECT * FROM deployed_agents LOOP
    SELECT deployed_agent_templates.agent_template_id INTO agent_template_id FROM deployed_agent_templates WHERE id = deployed_agent_row.deployed_agent_template_id;
    IF NOT FOUND THEN
      root_agent_template_id_value := NULL;
    ELSE
      SELECT agent_template_id INTO root_agent_template_id_value FROM agent_templates WHERE id = agent_template_id;
    END IF;
    UPDATE deployed_agents SET root_agent_template_id = root_agent_template_id_value WHERE id = deployed_agent_row.id;
  END LOOP;
END $$;

ALTER TABLE "deployed_agents" ALTER COLUMN "root_agent_template_id" DROP NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "deployed_agent_variables" ADD CONSTRAINT "deployed_agent_variables_deployed_agent_id_deployed_agents_id_fk" FOREIGN KEY ("deployed_agent_id") REFERENCES "public"."deployed_agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
