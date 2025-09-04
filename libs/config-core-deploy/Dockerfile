# The builder image, used to build the virtual environment
FROM python:3.12.2-bookworm AS builder
ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT}

# copy both uv and uvx to the bin directory of builder image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# necessary to set UV_PYTHON_PREFERENCE=system bc we need to defer to container's python version rather than uv's self-managed latest default
ENV UV_NO_PROGRESS=1 \
    UV_PYTHON_PREFERENCE=system \
    UV_CACHE_DIR=/tmp/uv_cache

WORKDIR /app

# copy dependencies and source code
COPY apps/core/pyproject.toml apps/core/uv.lock apps/core/README.md ./
COPY apps/core/letta ./letta
# necessary to pin Python version bc google-cloud-profiler doesn't support 3.13
RUN uv sync --frozen --no-dev --python 3.12 --extra postgres --extra redis --extra pinecone --extra experimental --extra bedrock --extra google --extra external-tools --extra cloud-tool-sandbox --extra modal

# The collector image, used to get the OpenTelemetry Collector
FROM otel/opentelemetry-collector-contrib:0.96.0 AS collector

# The runtime image, used to just run the code provided its virtual environment
FROM python:3.12.2-slim-bookworm AS runtime
ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT}
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

# TODO (cliandy): remove this when implemented in secrets v2
ENV REDIS_HOST="10.167.199.148"


# Copy OpenTelemetry Collector from collector stage
COPY --from=collector /otelcol-contrib /usr/local/bin/otelcol-contrib
RUN mkdir -p /etc/otel

# Copy uv, uvx, and venv packages from builder to runtime (technically unnecessary)
COPY --from=builder /bin/uv /bin/uvx /usr/local/bin/
COPY --from=builder ${VIRTUAL_ENV} ${VIRTUAL_ENV}

# Copy application code and configs
COPY ../apps/core/alembic.ini /alembic.ini
COPY ../apps/core/alembic /alembic
COPY ./libs/config-core-deploy/scripts /scripts
COPY ../apps/core/scripts /letta-scripts
COPY ../apps/core/otel/otel-collector-config-clickhouse-prod.yaml /etc/otel/config-clickhouse.yaml
COPY ../scripts/cloud-plugins /letta/plugins
COPY ../apps/core/letta /app/letta

EXPOSE 8283 4317 4318

RUN ["chmod", "+x", "./scripts/startup.sh"]
CMD ["./scripts/startup.sh"]
