#!/bin/bash
# Initialization script for Letta Web container

set -e

echo "Initializing Letta Web container..."

# Wait for Letta Server to be ready
echo "Waiting for Letta Server API..."
LETTA_ENDPOINT=${LETTA_AGENTS_ENDPOINT:-http://letta:8083}

for i in {1..60}; do
    if curl -f "${LETTA_ENDPOINT}/v1/health/" >/dev/null 2>&1; then
        echo "Letta Server API is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "WARNING: Letta Server API not ready after 60 seconds, starting web anyway..."
        break
    fi
    sleep 2
done

echo "Starting Letta Web..."
exec "$@"
