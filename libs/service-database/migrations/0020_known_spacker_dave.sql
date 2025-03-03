CREATE TABLE IF NOT EXISTS "embedding_models_metadata" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"model_endpoint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "embedding_models_metadata_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inference_models_metadata" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"model_endpoint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "inference_models_metadata_id_unique" UNIQUE("id")
);

--> create first inference model
INSERT INTO "inference_models_metadata" ("name", "brand", "model_name", "model_endpoint", "updated_at") VALUES ('gpt-4o', 'openai', 'gpt-4o', 'https://api.openai.com/v1', now());

--> create first embedding model
INSERT INTO "embedding_models_metadata" ("name", "brand", "model_name", "model_endpoint", "updated_at") VALUES ('text-embedding-ada-002', 'openai', 'text-embedding-ada-002', 'https://api.openai.com/v1', now());
