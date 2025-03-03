CREATE TABLE "cu_change_audit" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"previous_cu" numeric,
	"new_cu" numeric NOT NULL,
	"reason" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "default_cu_per_step" numeric;
