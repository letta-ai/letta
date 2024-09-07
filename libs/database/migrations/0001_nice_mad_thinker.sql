CREATE TABLE IF NOT EXISTS "deployed_agents" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_agents" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "testing_agents" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letta_agents_api_keys" RENAME TO "letta_api_keys";--> statement-breakpoint
ALTER TABLE "letta_api_keys" DROP CONSTRAINT "letta_agents_api_keys_api_key_unique";--> statement-breakpoint
ALTER TABLE "letta_api_keys" ADD COLUMN "salt" text NOT NULL;--> statement-breakpoint
ALTER TABLE "letta_api_keys" ADD CONSTRAINT "letta_api_keys_api_key_unique" UNIQUE("api_key");