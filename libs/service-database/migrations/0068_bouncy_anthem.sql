CREATE TABLE "organization_claimed_onboarding_rewards" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"reward_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_product_onboarding_step" (
	"user_id" text PRIMARY KEY NOT NULL,
	"completed_steps" json,
	"current_step" text
);
--> statement-breakpoint
ALTER TABLE "organization_claimed_onboarding_rewards" ADD CONSTRAINT "organization_claimed_onboarding_rewards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_onboarding_step" ADD CONSTRAINT "user_product_onboarding_step_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_reward_key" ON "organization_claimed_onboarding_rewards" USING btree ("reward_key","organization_id");--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "onboarding_step";
