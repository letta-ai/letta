CREATE TABLE IF NOT EXISTS "letta_agents_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key" text NOT NULL,
	"organization_id" serial NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "letta_agents_api_keys_api_key_unique" UNIQUE("api_key")
);
