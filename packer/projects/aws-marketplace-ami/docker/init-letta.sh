#!/bin/bash
# Initialization script for Letta Server container

set -e

echo "Initializing Letta Server container..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL at ${LETTA_PG_HOST}:${LETTA_PG_PORT}..."
while ! pg_isready -h "${LETTA_PG_HOST}" -p "${LETTA_PG_PORT}" -U "${LETTA_PG_USER}"; do
    echo "PostgreSQL not ready, waiting..."
    sleep 2
done

echo "PostgreSQL is ready!"

# Set environment variables for Letta
export LETTA_PG_DB=${LETTA_PG_DB:-letta}
export LETTA_PG_USER=${LETTA_PG_USER:-letta}
export LETTA_PG_PASSWORD=${LETTA_PG_PASSWORD:-letta123}
export LETTA_PG_HOST=${LETTA_PG_HOST:-letta-db}
export LETTA_PG_PORT=${LETTA_PG_PORT:-5432}

echo "Starting Letta server..."
exec "$@"
