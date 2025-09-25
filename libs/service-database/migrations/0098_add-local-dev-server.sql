-- create by default a local development server in development_servers for all existing organizations from organizations table --
INSERT INTO development_servers (organization_id, name, url, created_at, updated_at)
SELECT id, 'local', 'http://localhost:8283', NOW(), NOW()
FROM organizations
