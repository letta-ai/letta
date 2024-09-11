ALTER TABLE "users" ADD COLUMN "letta_agents_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_letta_agents_id_unique" UNIQUE("letta_agents_id");