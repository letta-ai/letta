ALTER TABLE "users" ALTER COLUMN "theme" SET DEFAULT 'auto';--> statement-breakpoint

--> Find any agent_simulator_sessions that share the same agent_template_id and delete all but the newest one
WITH duplicates AS (
  SELECT id, agent_template_id, created_at, ROW_NUMBER() OVER (PARTITION BY agent_template_id ORDER BY created_at DESC) AS row_number
  FROM agent_simulator_sessions
)
DELETE FROM agent_simulator_sessions
WHERE id IN (SELECT id FROM duplicates WHERE row_number > 1);


ALTER TABLE "agent_simulator_sessions" ADD CONSTRAINT "agent_simulator_sessions_agent_template_id_unique" UNIQUE("agent_template_id");
