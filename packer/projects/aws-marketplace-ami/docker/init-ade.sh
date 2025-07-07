#!/bin/bash
# Initialization script for ADE container

set -e

echo "Initializing ADE container..."

# Wait for Letta to be ready
echo "Waiting for Letta API..."
LETTA_ENDPOINT=${LETTA_ENDPOINT:-http://letta:8283}

for i in {1..60}; do
    if curl -f "${LETTA_ENDPOINT}/health" >/dev/null 2>&1; then
        echo "Letta API is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "WARNING: Letta API not ready after 60 seconds, starting ADE anyway..."
        break
    fi
    sleep 2
done

echo "Starting ADE..."
exec "$@"
