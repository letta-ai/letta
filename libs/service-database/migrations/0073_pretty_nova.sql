ALTER TABLE "organization_credit_transactions" ADD COLUMN "model_tier_type" "model_tier_enum";--> statement-breakpoint
ALTER TABLE "organization_credit_transactions" DROP COLUMN "model_tier";
