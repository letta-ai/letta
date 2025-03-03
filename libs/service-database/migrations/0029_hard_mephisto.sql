ALTER TYPE "signup_methods" ADD VALUE 'github';--> statement-breakpoint
ALTER TABLE "tool_group_metadata" ALTER COLUMN "image_url" DROP NOT NULL;