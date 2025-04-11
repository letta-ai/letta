-- Title: Init Letta Database

-- Fetch the docker secrets, if they are available.
-- Otherwise fall back to environment variables, or hardwired 'letta'
\set db_user `([ -r /var/run/secrets/letta-user ] && cat /var/run/secrets/letta-user) || echo "${POSTGRES_USER:-letta}"`
\set db_password `([ -r /var/run/secrets/letta-password ] && cat /var/run/secrets/letta-password) || echo "${POSTGRES_PASSWORD:-letta}"`
\set db_name `([ -r /var/run/secrets/letta-db ] && cat /var/run/secrets/letta-db) || echo "${POSTGRES_DB:-letta}"`
\set schema_name `([ -r /var/run/secrets/letta-schema ] && cat /var/run/secrets/letta-schema) || echo "${POSTGRES_SCHEMA:-letta}"`

-- CREATE USER :"db_user"
--     WITH PASSWORD :'db_password'
--     NOCREATEDB
--     NOCREATEROLE
--     ;
--
-- CREATE DATABASE :"db_name"
--     WITH
--     OWNER = :"db_user"
--     ENCODING = 'UTF8'
--     LC_COLLATE = 'en_US.utf8'
--     LC_CTYPE = 'en_US.utf8'
--     LOCALE_PROVIDER = 'libc'
--     TABLESPACE = pg_default
--     CONNECTION LIMIT = -1;

-- Set up our schema and extensions in our new database.
\c :"db_name"

CREATE SCHEMA :"schema_name"
    AUTHORIZATION :"db_user";

ALTER DATABASE :"db_name"
    SET search_path TO :"schema_name", public;

ALTER ROLE :"db_user" SET search_path TO :"schema_name", public;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA :"schema_name";
