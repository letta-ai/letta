
-- THIS IS THE INITIALIZATION SCRIPT FOR EXTERNAL DATABASE

-- DROP SCHEMA IF EXISTS letta CASCADE

-- Title: Init Letta Database

-- Fetch the docker secrets, if they are available.
-- Otherwise fall back to environment variables, or hardwired 'letta'
\set db_application_user `echo "${POSTGRES_APPLICATION_USER:-letta}"`
\set db_admin_user `echo "${POSTGRES_ADMIN_USER:-admin}"`
\set db_application_password `echo "${POSTGRES_APPLICATION_PASSWORD:-letta}"`
\set db_admin_password `echo "${POSTGRES_ADMIN_PASSWORD:-letta}"`
\set db_name `echo "${POSTGRES_DB:-letta}"`
\set schema_name `echo "${POSTGRES_SCHEMA:-letta}"`

CREATE USER :"db_application_user"
    WITH PASSWORD :'db_application_password'
    NOCREATEDB
    NOCREATEROLE
    ;


CREATE DATABASE :"db_name"
    WITH
    OWNER = :"db_application_user"
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.utf8'
    LC_CTYPE = 'en_US.utf8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Set up our schema and extensions in our new database.
\c :"db_name"

CREATE SCHEMA :"schema_name"
    AUTHORIZATION :"db_application_user";

ALTER DATABASE :"db_name"
    SET search_path TO :"schema_name", public;

ALTER ROLE :"db_application_user" SET search_path TO :"schema_name", public;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA :"schema_name";

--- ADD PRIVILEGES TO EXTERNAL DATABASE USERS

GRANT ALL ON SCHEMA :"schema_name" TO postgres;
GRANT ALL ON SCHEMA :"schema_name" TO :"db_admin_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON TABLES TO :"db_admin_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON SEQUENCES TO :"db_admin_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema_name"
GRANT ALL ON FUNCTIONS TO :"db_admin_user";