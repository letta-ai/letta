ALTER TABLE "organization_invites" ADD COLUMN "invite_code" text;
--> remove all existing invites
DELETE FROM "organization_invites";
--> make invite_code not null
ALTER TABLE "organization_invites" ALTER COLUMN "invite_code" SET NOT NULL;
