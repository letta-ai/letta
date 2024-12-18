--> Delete all the data from inference_transactions before, as the data was bad
DELETE FROM inference_transactions;

ALTER TABLE "inference_transactions" ADD COLUMN "source" text NOT NULL;

