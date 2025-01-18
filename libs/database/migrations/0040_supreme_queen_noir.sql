ALTER TABLE "organization_credit_transactions" ADD COLUMN "source" text;
--> set source to "migration" for all existing rows
UPDATE "organization_credit_transactions" SET "source" = 'migration';
--> set as NOT NULL
ALTER TABLE "organization_credit_transactions" ALTER COLUMN "source" SET NOT NULL;
