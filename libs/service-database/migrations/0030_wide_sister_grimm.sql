ALTER TABLE "deployed_agent_variables" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "deployed_agent_variables" ADD COLUMN "deleted_at" timestamp;
--> loop through all existing deployed_agent_variables and set organization_id to the organization_id of the agent that you can reference from deployed_agents table using deployedAgentId and id else delete the record

DO $$ DECLARE
    deployed_agent_variable_row RECORD;
    organization_id_value text;
BEGIN
    FOR deployed_agent_variable_row IN SELECT * FROM deployed_agent_variables LOOP
        SELECT organization_id INTO organization_id_value FROM deployed_agents WHERE id = deployed_agent_variable_row.deployed_agent_id;
        IF NOT FOUND THEN
            DELETE FROM deployed_agent_variables WHERE deployed_agent_id = deployed_agent_variable_row.deployed_agent_id;
        ELSE
            UPDATE deployed_agent_variables SET organization_id = organization_id_value WHERE deployed_agent_id = deployed_agent_variable_row.deployed_agent_id;
        END IF;
    END LOOP;
END $$;


ALTER TABLE "deployed_agent_variables" ALTER COLUMN "organization_id" SET NOT NULL;
