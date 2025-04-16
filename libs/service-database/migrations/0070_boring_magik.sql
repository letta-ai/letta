CREATE TABLE "client_side_access_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"core_user_id" text NOT NULL,
	"requester_user_id" text,
	"policy" json NOT NULL,
	"host" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "client_side_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "client_side_access_tokens" ADD CONSTRAINT "client_side_access_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
