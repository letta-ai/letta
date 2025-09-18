CREATE TABLE "simulated_group" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"letta_template_id" text NOT NULL,
	"deployment_id" text,
	"updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "simulated_group_group_id_unique" UNIQUE("group_id")
);

--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD COLUMN "letta_template_id" text;--> statement-breakpoint
--> get letta_template_id from agent_template from agent_template_id
UPDATE "simulated_agent_v2" SET "letta_template_id" = at."letta_template_id"
FROM "agent_template_v2" at WHERE "simulated_agent_v2"."agent_template_v2_id" = at."id";--> statement-breakpoint
--> make letta_template_id not null
ALTER TABLE "simulated_agent_v2" ALTER COLUMN "letta_template_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "simulated_group" ADD CONSTRAINT "simulated_group_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_group" ADD CONSTRAINT "simulated_group_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_group" ADD CONSTRAINT "simulated_group_letta_template_id_letta_templates_id_fk" FOREIGN KEY ("letta_template_id") REFERENCES "public"."letta_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_default_simulated_group" ON "simulated_group" USING btree ("letta_template_id","is_default");--> statement-breakpoint
ALTER TABLE "simulated_agent_v2" ADD CONSTRAINT "simulated_agent_v2_letta_template_id_letta_templates_id_fk" FOREIGN KEY ("letta_template_id") REFERENCES "public"."letta_templates"("id") ON DELETE cascade ON UPDATE no action;
