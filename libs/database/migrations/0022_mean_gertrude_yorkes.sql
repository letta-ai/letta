ALTER TABLE "inference_transactions" ADD COLUMN "project_id" text;

--> delete from deployed_agents where deleted_at is not null;
DELETE FROM "deployed_agents" WHERE "deleted_at" IS NOT NULL;
