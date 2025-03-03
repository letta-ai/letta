ALTER TABLE "organizations" ADD COLUMN "enabled_cloud_at" timestamp;

DO $$
DECLARE
    organization_id text;
BEGIN
    FOR organization_id IN SELECT id FROM organizations
    LOOP
        UPDATE organizations SET enabled_cloud_at = now() WHERE id = organization_id;
    END LOOP;
END;
$$;
