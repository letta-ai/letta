CREATE TABLE IF NOT EXISTS "inference_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"input_tokens" numeric NOT NULL,
	"output_tokens" numeric NOT NULL,
	"total_tokens" numeric NOT NULL,
	"step_count" numeric NOT NULL,
	"providerType" text NOT NULL,
	"providerEndpoint" text NOT NULL,
	"providerModel" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL
);
