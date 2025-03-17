#!/bin/sh

echo "Starting OpenTelemetry Collector..."

OTEL_LOG_LEVEL=debug otelcol-contrib --config /etc/otel/config-clickhouse.yaml &

echo "Starting MEMGPT server..."

alembic upgrade head

poetry run letta server --host 0.0.0.0 --port 8083
