CREATE TABLE "step_cost_schema_audit" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"step_cost_schema" json NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "cu_change_audit" CASCADE;--> statement-breakpoint
ALTER TABLE "step_cost_schema_audit" ADD CONSTRAINT "step_cost_schema_audit_model_id_inference_models_metadata_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."inference_models_metadata"("id") ON DELETE cascade ON UPDATE no action;
