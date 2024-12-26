ALTER TABLE "organization_preferences" RENAME COLUMN "catch_all_agents_project_id" TO "default_project_id";--> statement-breakpoint
--> if there is a organization_preferences with no default_project_id, look up projects table with 'organization_id' and set the first project_id as default_project_id, if organization has no projects if organization has no projects create a project with organization_id and set it as default_project_id, projects by default have a not null slug, name, organization_id, created_at, updated_at, set slug to 'default', name to 'Default', created_at and updated_at to now()
--> statement-breakpoint
DO $$ DECLARE
    organization_preferences_row RECORD;
    project_id_value text;
    organization_id_value text;
    project_row RECORD;
BEGIN
    FOR organization_preferences_row IN SELECT * FROM organization_preferences WHERE default_project_id IS NULL LOOP
        SELECT organization_id INTO organization_id_value FROM organization_preferences WHERE id = organization_preferences_row.id;
        SELECT id INTO project_id_value FROM projects WHERE organization_id = organization_id_value LIMIT 1;
        IF NOT FOUND THEN
            INSERT INTO projects (slug, name, organization_id, created_at, updated_at) VALUES ('default', 'Default', organization_id_value, NOW(), NOW()) RETURNING id INTO project_id_value;
        END IF;
        UPDATE organization_preferences SET default_project_id = project_id_value WHERE id = organization_preferences_row.id;
    END LOOP;
END $$;
ALTER TABLE "organization_preferences" ALTER COLUMN "default_project_id" SET NOT NULL;
