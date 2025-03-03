DELETE FROM agent_simulator_sessions WHERE organization_id IS NULL;
ALTER TABLE "agent_simulator_sessions" ALTER COLUMN "organization_id" SET NOT NULL;
