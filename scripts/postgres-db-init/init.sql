
SELECT 'CREATE DATABASE "letta-web"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'letta-web')\gexec

SELECT 'CREATE DATABASE "letta-core"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'letta-core')\gexec


\c letta-core

CREATE EXTENSION IF NOT EXISTS vector;
