--> give all users the role of 'admin' by default

UPDATE "organization_users" SET "role" = 'admin';
ALTER TABLE "organization_users" ALTER COLUMN "role" SET NOT NULL;
