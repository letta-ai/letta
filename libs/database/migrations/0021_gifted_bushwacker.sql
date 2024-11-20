ALTER TABLE "inference_models_metadata" ADD COLUMN "is_recommended" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inference_models_metadata" ADD COLUMN "tag" text;
--> make is_recommended false to all existing rows
UPDATE "inference_models_metadata" SET "is_recommended" = false;

--> make is_recommended not null
ALTER TABLE "inference_models_metadata" ALTER COLUMN "is_recommended" SET NOT NULL;

--> write a script that removes all blocks where user does not exist in users table given user_id
CREATE OR REPLACE FUNCTION remove_blocks_without_user()
RETURNS void AS $$
DECLARE
    user_id_value text;
BEGIN
    FOR user_id_value IN SELECT user_id FROM inference_models_metadata
    LOOP
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_value) THEN
            DELETE FROM inference_models_metadata WHERE user_id = user_id_value;
        END IF;
    END LOOP;
END;

SELECT remove_blocks_without_user();

--> write script in postgres to remove all blocks where user does not exist in users table given user_id
CREATE OR REPLACE FUNCTION remove_blocks_without_user()
RETURNS void AS $$
DECLARE
    user_id_value text;
BEGIN
    FOR user_id_value IN SELECT user_id FROM inference_models_metadata
    LOOP
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_value) THEN
            DELETE FROM inference_models_metadata WHERE user_id = user_id_value;
        END IF;
    END LOOP;
END;

$$ LANGUAGE plpgsql;

SELECT remove_blocks_without_user();
