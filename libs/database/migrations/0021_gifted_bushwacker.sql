ALTER TABLE "inference_models_metadata" ADD COLUMN "is_recommended" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "tag" text;
--> make is_recommended false to all existing rows
UPDATE "inference_models_metadata" SET "is_recommended" = false;

--> make is_recommended not null
ALTER TABLE "inference_models_metadata" ALTER COLUMN "is_recommended" SET NOT NULL;
