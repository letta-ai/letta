CREATE TABLE "step_cost_schema_by_model_id" (
	"model_id" text PRIMARY KEY NOT NULL,
	"step_cost_schema" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "step_cost_schema_by_model_id" ADD CONSTRAINT "step_cost_schema_by_model_id_model_id_inference_models_metadata_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."inference_models_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_models_metadata" DROP COLUMN "default_cu_per_step";
--> create a step cost schema for each model, the schema is { version: '1', data [] }
INSERT INTO "step_cost_schema_by_model_id" ("model_id", "step_cost_schema") SELECT "id", '{"version": "1", "data": []}' FROM "inference_models_metadata";
