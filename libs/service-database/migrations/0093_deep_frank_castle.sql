ALTER TABLE "agent_template_v2" ADD COLUMN "agent_type" text;
--> set all existing agent_type to memgpt_v2_agent
UPDATE "agent_template_v2" SET "agent_type" = 'memgpt_v2_agent';
--> make the column not null
ALTER TABLE "agent_template_v2" ALTER COLUMN "agent_type" SET NOT NULL;
