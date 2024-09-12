CREATE TABLE IF NOT EXISTS "deployed_agents_statistics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_count" bigint DEFAULT 0 NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL
);
