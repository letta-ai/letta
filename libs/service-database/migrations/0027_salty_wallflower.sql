DO $$ BEGIN
 CREATE TYPE "public"."provider_enum" AS ENUM('composio', 'generic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_group_metadata" (
	"brand" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "tool_group_metadata_brand_unique" UNIQUE("brand")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_metadata" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"brand" text NOT NULL,
	"provider" "provider_enum" NOT NULL,
	"provider_id" text NOT NULL,
	"configuration" json,
	"tags" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "tool_metadata_id_unique" UNIQUE("id")
);
