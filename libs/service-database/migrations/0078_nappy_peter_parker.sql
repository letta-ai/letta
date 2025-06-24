CREATE TYPE "public"."agentfile_access_level" AS ENUM('public', 'logged-in', 'none');--> statement-breakpoint
CREATE TABLE "agentfile_permissions" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"agentfile_access_level" "agentfile_access_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
