ALTER TABLE "organization_credit_transactions" ADD COLUMN "true_cost" numeric;
-- set amount to true_cost where true_cost is null
UPDATE "organization_credit_transactions" SET "true_cost" = "amount" WHERE "true_cost" IS NULL;
-- set true_cost to not null
ALTER TABLE "organization_credit_transactions" ALTER COLUMN "true_cost" SET NOT NULL;
