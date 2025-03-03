ALTER TABLE "embedding_models_metadata" ADD COLUMN "default_requests_per_minute_per_organization" numeric DEFAULT '1000';--> statement-breakpoint
ALTER TABLE "embedding_models_metadata" ADD COLUMN "default_tokens_per_minute_per_organization" numeric DEFAULT '1000';--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "default_requests_per_minute_per_organization" numeric DEFAULT '1000';--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "default_tokens_per_minute_per_organization" numeric DEFAULT '1000';

--> Set all existing values to 1000
UPDATE "embedding_models_metadata" SET "default_requests_per_minute_per_organization" = 1000;
UPDATE "embedding_models_metadata" SET "default_tokens_per_minute_per_organization" = 1000;
UPDATE "inference_models_metadata" SET "default_requests_per_minute_per_organization" = 1000;
UPDATE "inference_models_metadata" SET "default_tokens_per_minute_per_organization" = 1000;

--> set as not null
ALTER TABLE "embedding_models_metadata" ALTER COLUMN "default_requests_per_minute_per_organization" SET NOT NULL;
ALTER TABLE "embedding_models_metadata" ALTER COLUMN "default_tokens_per_minute_per_organization" SET NOT NULL;
ALTER TABLE "inference_models_metadata" ALTER COLUMN "default_requests_per_minute_per_organization" SET NOT NULL;
ALTER TABLE "inference_models_metadata" ALTER COLUMN "default_tokens_per_minute_per_organization" SET NOT NULL;
