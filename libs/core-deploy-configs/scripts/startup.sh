#!/bin/sh
echo "Starting MEMGPT server..."

alembic upgrade head

poetry run letta server --host 0.0.0.0 --port 8083
