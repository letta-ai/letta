# Excellent blog post on using poetry in docker: https://medium.com/@albertazzir/blazing-fast-python-docker-builds-with-poetry-a78a66f5aed0

# =======================================================================
# Builder image
# =======================================================================

# The builder image, used to build the virtual environment
# slim image here fails because of psycopg2 install
FROM python:3.12.2-bookworm AS builder

# Install build dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install poetry==2.1.3

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

WORKDIR /app

# Copy dependency files first for better layer caching
COPY apps/core/pyproject.toml apps/core/poetry.lock ./
# Remove poetry cache in same step for efficient docker layer caching
RUN --mount=type=cache,target=$POETRY_CACHE_DIR poetry install --no-root --all-extras

# =======================================================================
# Collector image
# =======================================================================

# The collector image, used to get the OpenTelemetry Collector
FROM otel/opentelemetry-collector-contrib:0.96.0 AS collector

# =======================================================================
# Runtime image
# =======================================================================

# The runtime image, used to just run the code provided its virtual environment
FROM python:3.12.2-slim-bookworm AS runtime
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

# Copy OpenTelemetry Collector from collector stage
COPY --from=collector /otelcol-contrib /usr/local/bin/otelcol-contrib
RUN mkdir -p /etc/otel

# Copy virtual environment from builder
COPY --from=builder ${VIRTUAL_ENV} ${VIRTUAL_ENV}

# Copy application code and configs in order of least frequently changed to most
COPY ../scripts/cloud-plugins /letta/plugins
COPY ../apps/core/alembic.ini /alembic.ini
COPY ../apps/core/otel/otel-collector-config-clickhouse-prod.yaml /etc/otel/config-clickhouse.yaml
# Tightly couple the permissioning of startup script
COPY ./libs/config-core-deploy/scripts /scripts
RUN ["chmod", "+x", "./scripts/startup.sh"]
COPY ../apps/core/scripts /letta-scripts
COPY ../apps/core/alembic /alembic
COPY ../apps/core/letta /letta

EXPOSE 8283 4317 4318

CMD ./scripts/startup.sh
