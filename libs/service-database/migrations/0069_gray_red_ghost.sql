ALTER TABLE "user_product_onboarding_step" ADD COLUMN "paused_at" timestamp;
--> Create a user_product_onboarding_step row for every user if it doesn't exist
INSERT INTO user_product_onboarding_step (user_id) SELECT id FROM "users" WHERE id NOT IN (SELECT user_id FROM user_product_onboarding_step);
