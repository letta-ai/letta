# The builder image, used to build the virtual environment
FROM python:3.12.2-bookworm as builder
ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT}
RUN pip install poetry==1.8.2

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

WORKDIR /app

COPY MemGPT/pyproject.toml MemGPT/poetry.lock ./
RUN poetry lock --no-update
RUN poetry install --no-root --all-extras

# The runtime image, used to just run the code provided its virtual environment
FROM python:3.12.2-slim-bookworm as runtime
ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT}
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

# Copy poetry from builder to runtime
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/poetry /usr/local/bin/poetry
COPY --from=builder ${VIRTUAL_ENV} ${VIRTUAL_ENV}

# Copy the poetry.lock and pyproject.toml files
COPY --from=builder /app/pyproject.toml /app/poetry.lock /

COPY ../apps/core/letta /letta
COPY ../apps/core/alembic.ini /alembic.ini
COPY ../apps/core/alembic /alembic
COPY ./scripts /scripts
COPY ../apps/core/scripts /letta-scripts

EXPOSE 8283

RUN ["chmod", "+x", "./scripts/startup.sh"]
CMD ./scripts/startup.sh
