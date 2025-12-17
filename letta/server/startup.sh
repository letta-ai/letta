#!/bin/sh
set -e  # Exit on any error

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8283}"

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    until pg_isready -U "${POSTGRES_USER:-letta}" -h localhost; do
        echo "Waiting for PostgreSQL to be ready..."
        sleep 2
    done
}

# Function to wait for Redis to be ready
wait_for_redis() {
    until redis-cli ping 2>/dev/null | grep -q PONG; do
        echo "Waiting for Redis to be ready..."
        sleep 1
    done
}

# Check if we're configured for external Redis
if [ -n "$LETTA_REDIS_HOST" ]; then
    echo "External Redis configuration detected, using env var LETTA_REDIS_HOST=$LETTA_REDIS_HOST"
else
    echo "No external Redis configuration detected, starting internal Redis..."
    redis-server --daemonize yes --bind 0.0.0.0

    # Wait for Redis to be ready
    wait_for_redis

    # Set default Redis host for internal redis
    export LETTA_REDIS_HOST="localhost"
    echo "Using internal Redis at: $LETTA_REDIS_HOST"
fi

# Check if we're configured for external Postgres
if [ -n "$LETTA_PG_URI" ]; then
    echo "External Postgres configuration detected, using env var LETTA_PG_URI"
else
    echo "No external Postgres configuration detected, starting internal PostgreSQL..."
    # Start PostgreSQL using the base image's entrypoint script
    /usr/local/bin/docker-entrypoint.sh postgres &

    # Wait for PostgreSQL to be ready
    wait_for_postgres

    # Set default connection URI for internal postgres
    export LETTA_PG_URI="postgresql://${POSTGRES_USER:-letta}:${POSTGRES_PASSWORD:-letta}@localhost:5432/${POSTGRES_DB:-letta}"
    echo "Using internal PostgreSQL at: $LETTA_PG_URI"
fi

# Attempt database migration
echo "Attempting to migrate database..."
if ! alembic upgrade head; then
    echo "ERROR: Database migration failed!"
    echo "Please check your database connection and try again."
    echo "If the problem persists, check the logs for more details."
    exit 1
fi
echo "Database migration completed successfully."

# Set permissions for tool execution directory if configured
if [ -n "$LETTA_SANDBOX_MOUNT_PATH" ]; then
    if ! chmod 777 "$LETTA_SANDBOX_MOUNT_PATH"; then
        echo "ERROR: Failed to set permissions for tool execution directory at: $LETTA_SANDBOX_MOUNT_PATH"
        echo "Please check that the directory exists and is accessible"
        exit 1
    fi
fi

# If ADE is enabled, add the --ade flag to the command
CMD="letta server --host $HOST --port $PORT"
if [ "${SECURE:-false}" = "true" ]; then
    CMD="$CMD --secure"
fi

# Start OpenTelemetry Collector in the background
if [ -n "$CLICKHOUSE_ENDPOINT" ] && [ -n "$CLICKHOUSE_PASSWORD" ]; then
    echo "Starting OpenTelemetry Collector with Clickhouse export..."
    CONFIG_FILE="/etc/otel/config-clickhouse.yaml"
elif [ -n "$SIGNOZ_ENDPOINT" ] && [ -n "$SIGNOZ_INGESTION_KEY" ]; then
    echo "Starting OpenTelemetry Collector with Signoz export..."
    CONFIG_FILE="/etc/otel/config-signoz.yaml"
else
    echo "Starting OpenTelemetry Collector with file export only..."
    CONFIG_FILE="/etc/otel/config-file.yaml"
fi

/usr/local/bin/otelcol-contrib --config "$CONFIG_FILE" &
OTEL_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo "Shutting down..."
    kill $OTEL_PID
    wait $OTEL_PID
}
trap cleanup EXIT

echo "Starting Letta Server at http://$HOST:$PORT..."
echo "Executing: $CMD"
exec $CMD
