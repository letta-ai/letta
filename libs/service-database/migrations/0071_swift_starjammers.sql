CREATE TYPE "public"."model_tier_enum" AS ENUM('free', 'premium', 'per-inference');--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "tier" "model_tier_enum";
UPDATE "inference_models_metadata" SET "tier" = 'per-inference' WHERE "tier" IS NULL;
ALTER TABLE "inference_models_metadata" ALTER COLUMN "tier" SET NOT NULL;
