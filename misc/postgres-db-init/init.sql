
SELECT 'CREATE DATABASE letta'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'letta')\gexec

SELECT 'CREATE DATABASE memgpt'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'memgpt')\gexec


\c memgpt

CREATE EXTENSION IF NOT EXISTS vector;
