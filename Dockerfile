# Start with pgvector base for builder
FROM ankane/pgvector:v0.5.1 AS builder

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-full \
    build-essential \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

ARG LETTA_ENVIRONMENT=DEV
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT} \
    UV_NO_PROGRESS=1 \
    UV_PYTHON_PREFERENCE=system \
    UV_CACHE_DIR=/tmp/uv_cache

# Set for other builds
ARG LETTA_VERSION
ENV LETTA_VERSION=${LETTA_VERSION}

WORKDIR /app

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Now install uv and uvx in the virtual environment
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/


# Copy dependency files first
COPY pyproject.toml uv.lock ./
# Then copy the rest of the application code
COPY . .

RUN uv sync --frozen --no-dev --all-extras --python 3.11

# Runtime stage
FROM ankane/pgvector:v0.5.1 AS runtime

# Overridable Node.js version with --build-arg NODE_VERSION
ARG NODE_VERSION=22

RUN apt-get update && \
    # Install curl, Python, and PostgreSQL client libraries
    apt-get install -y curl python3 python3-venv libpq-dev && \
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    # Install OpenTelemetry Collector
    curl -L https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.96.0/otelcol-contrib_0.96.0_linux_amd64.tar.gz -o /tmp/otel-collector.tar.gz && \
    tar xzf /tmp/otel-collector.tar.gz -C /usr/local/bin && \
    rm /tmp/otel-collector.tar.gz && \
    mkdir -p /etc/otel && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add OpenTelemetry Collector configs
COPY otel/otel-collector-config-file.yaml /etc/otel/config-file.yaml
COPY otel/otel-collector-config-clickhouse.yaml /etc/otel/config-clickhouse.yaml
COPY otel/otel-collector-config-signoz.yaml /etc/otel/config-signoz.yaml

ARG LETTA_ENVIRONMENT=DEV
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT} \
    VIRTUAL_ENV="/app/.venv" \
    PATH="/app/.venv/bin:$PATH" \
    POSTGRES_USER=letta \
    POSTGRES_PASSWORD=letta \
    POSTGRES_DB=letta \
    COMPOSIO_DISABLE_VERSION_CHECK=true

ARG LETTA_VERSION
ENV LETTA_VERSION=${LETTA_VERSION}

WORKDIR /app

# Copy virtual environment and app from builder
COPY --from=builder /app .

# Copy initialization SQL if it exists
COPY init.sql /docker-entrypoint-initdb.d/

EXPOSE 8283 5432 4317 4318

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["./letta/server/startup.sh"]
