CREATE TYPE "public"."letta_template_types" AS ENUM('classic', 'cluster', 'sleeptime', 'round_robin', 'supervisor', 'dynamic', 'voice_sleeptime');--> statement-breakpoint
CREATE TABLE "agent_template_block_templates" (
	"agent_template_v2_id" text NOT NULL,
	"block_template_id" text NOT NULL,
	"letta_template_id" text NOT NULL,
	"block_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_template_block_templates_agent_template_v2_id_block_template_id_pk" PRIMARY KEY("agent_template_v2_id","block_template_id"),
	CONSTRAINT "unique_block_label_per_agent_schema" UNIQUE("agent_template_v2_id","block_label")
);
--> statement-breakpoint
CREATE TABLE "agent_template_v2" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text DEFAULT 'default' NOT NULL,
	"entity_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"letta_template_id" text NOT NULL,
	"memory_variables" json,
	"tool_variables" json,
	"tags" jsonb,
	"identity_ids" jsonb,
	"system_prompt" text NOT NULL,
	"tool_ids" jsonb,
	"tool_rules" jsonb,
	"source_ids" jsonb,
	"model" text NOT NULL,
	"properties" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_template" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"project_id" text NOT NULL,
	"letta_template_id" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"limit" integer DEFAULT 1 NOT NULL,
	"description" text NOT NULL,
	"preserve_on_migration" boolean,
	"read_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letta_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"version" text DEFAULT 'current' NOT NULL,
	"latest_deployed" boolean,
	"description" text NOT NULL,
	"type" "letta_template_types" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"updated_at" timestamp NOT NULL,
	"message" text NOT NULL,
	"group_configuration" jsonb,
	"migration_original_template_id" text,
	"migration_original_deployed_template_id" text
);
--> statement-breakpoint
CREATE TABLE "simulated_agent_v2" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"agent_template_v2_id" text NOT NULL,
	"memory_variables" json,
	"updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "simulated_agent_v2_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
ALTER TABLE "ab_test_agent_templates" DROP CONSTRAINT "ab_test_agent_templates_simulated_agent_id_simulated_agent_real_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_template_block_templates" ADD CONSTRAINT "agent_template_block_templates_agent_template_v2_id_agent_template_v2_id_fk" FOREIGN KEY ("agent_template_v2_id") REFERENCES "public"."agent_template_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_template_block_templates" ADD CONSTRAINT "agent_template_block_templates_block_template_id_block_template_id_fk" FOREIGN KEY ("block_template_id") REFERENCES "public"."block_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_template_block_templates" ADD CONSTRAINT "agent_template_block_templates_letta_template_id_letta_templates_id_fk" FOREIGN KEY ("letta_template_id") REFERENCES "public"."letta_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_template_v2" ADD CONSTRAINT "agent_template_v2_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_template_v2" ADD CONSTRAINT "agent_template_v2_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_template_v2" ADD CONSTRAINT "agent_template_v2_letta_template_id_letta_templates_id_fk" FOREIGN KEY ("letta_template_id") REFERENCES "public"."letta_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_template" ADD CONSTRAINT "block_template_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_template" ADD CONSTRAINT "block_template_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_template" ADD CONSTRAINT "block_template_letta_template_id_letta_templates_id_fk" FOREIGN KEY ("letta_template_id") REFERENCES "public"."letta_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letta_templates" ADD CONSTRAINT "letta_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letta_templates" ADD CONSTRAINT "letta_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letta_templates" ADD CONSTRAINT "letta_templates_migration_original_template_id_agent_templates_id_fk" FOREIGN KEY ("migration_original_template_id") REFERENCES "public"."agent_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letta_templates" ADD CONSTRAINT "letta_templates_migration_original_deployed_template_id_deployed_agent_templates_id_fk" FOREIGN KEY ("migration_original_deployed_template_id") REFERENCES "public"."deployed_agent_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD CONSTRAINT "simulated_agent_v2_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD CONSTRAINT "simulated_agent_v2_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD CONSTRAINT "simulated_agent_v2_agent_template_v2_id_agent_template_v2_id_fk" FOREIGN KEY ("agent_template_v2_id") REFERENCES "public"."agent_template_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_agent_entity_id_per_letta_template" ON "agent_template_v2" USING btree ("entity_id","letta_template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_block_entity_id_per_letta_template" ON "block_template" USING btree ("entity_id","letta_template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_name_with_version" ON "letta_templates" USING btree ("name","organization_id","project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_default_simulated_agent_to_agent_template" ON "simulated_agent_v2" USING btree ("agent_template_v2_id","is_default");--> statement-breakpoint
ALTER TABLE "ab_test_agent_templates" ADD CONSTRAINT "ab_test_agent_templates_simulated_agent_id_simulated_agent_v2_id_fk" FOREIGN KEY ("simulated_agent_id") REFERENCES "public"."simulated_agent_v2"("id") ON DELETE cascade ON UPDATE no action;


--> statement-breakpoint
-- Data Migration: agent_templates to letta_templates system
-- Step 1: Migrate agent_templates to letta_templates (version='current')
INSERT INTO "letta_templates" (
  "id",
  "name",
  "organization_id",
  "project_id",
  "version",
  "description",
  "type",
  "message",
  "created_at",
  "deleted_at",
  "updated_at",
  "migration_original_template_id"
)
SELECT
  "id",
  "name",
  "organization_id",
  "project_id",
  'current',
  '',
  'classic',
  '',
  "created_at",
  "deleted_at",
  "updated_at",
  "id"
FROM "agent_templates";
--> statement-breakpoint
-- Step 2: Migrate deployed_agent_templates to letta_templates (version=numeric)
INSERT INTO "letta_templates" (
  "id",
  "name",
  "organization_id",
  "project_id",
  "version",
  "latest_deployed",
  "description",
  "type",
  "message",
  "created_at",
  "deleted_at",
  "updated_at",
  "migration_original_deployed_template_id"
)
SELECT
  dat."id",
  at."name",
  dat."organization_id",
  dat."project_id",
  dat."version",
  CASE
    WHEN CAST(dat."version" AS INTEGER) = (
      SELECT MAX(CAST(dat2."version" AS INTEGER))
      FROM "deployed_agent_templates" dat2
             JOIN "agent_templates" at2 ON dat2."agent_template_id" = at2."id"
      WHERE at2."name" = at."name"
        AND dat2."project_id" = dat."project_id"
        AND dat2."deleted_at" IS NULL
        AND dat2."version" ~ '^[0-9]+$'
  ) AND dat."deleted_at" IS NULL THEN true
    ELSE NULL
END,
  '',
  'classic',
  COALESCE(dat."message", ''),
  dat."created_at",
  dat."deleted_at",
  dat."updated_at",
  dat."id"
FROM "deployed_agent_templates" dat
JOIN "agent_templates" at ON dat."agent_template_id" = at."id";
