#!/bin/bash
set -e  # Exit on any error

# Create bin directory if it doesn't exist
mkdir -p bin

# Download and extract collector if not already present
if [ ! -f "bin/otelcol-contrib" ]; then
    echo "Downloading OpenTelemetry Collector..."
    curl -L https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.96.0/otelcol-contrib_0.96.0_darwin_amd64.tar.gz -o otelcol.tar.gz
    tar xzf otelcol.tar.gz -C bin/
    rm otelcol.tar.gz
    chmod +x bin/otelcol-contrib
fi

# Start OpenTelemetry Collector
if [ -n "$CLICKHOUSE_ENDPOINT" ] && [ -n "$CLICKHOUSE_PASSWORD" ]; then
    echo "Starting OpenTelemetry Collector with Clickhouse export..."
    CONFIG_FILE="otel-collector-config-clickhouse-dev.yaml"
else
    echo "Starting OpenTelemetry Collector with file export only..."
    CONFIG_FILE="otel-collector-config-file-dev.yaml"
fi

# Run collector
exec ./bin/otelcol-contrib --config "$CONFIG_FILE"
