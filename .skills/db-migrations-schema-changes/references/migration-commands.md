# Migration commands (letta-cloud core)

Working directory for all commands: `apps/core`.

## Environment setup

- One-shot environment + DB setup:
  - `just ready`

## Postgres connection

Set the Postgres URI (adjust as needed for your env):

```bash
export LETTA_PG_URI=postgresql+pg8000://postgres:postgres@localhost:5432/letta-core
```

Alembic will log the effective URL (e.g. `Using database:  postgresql+pg8000://...`).

## Alembic basics (with uv)

- Upgrade to latest:

```bash
uv run alembic upgrade head
```

- Downgrade one step:

```bash
uv run alembic downgrade -1
```

- Downgrade to a specific revision:

```bash
uv run alembic downgrade <revision_id>
```

- Generate new revision (autogenerate):

```bash
uv run alembic revision --autogenerate -m "short_message"
```

- Generate empty revision (manual operations):

```bash
uv run alembic revision -m "manual_migration"
```

## Typical workflow snippets

### Add/modify column

```bash
cd apps/core
just ready                       # optional but recommended
export LETTA_PG_URI=postgresql+pg8000://postgres:postgres@localhost:5432/letta-core
uv run alembic upgrade head      # ensure DB is up to date
uv run alembic revision --autogenerate -m "add_<column>_to_<table>"
uv run alembic upgrade head
```

### Re-run last migration after edit (local only)

```bash
cd apps/core
export LETTA_PG_URI=postgresql+pg8000://postgres:postgres@localhost:5432/letta-core
uv run alembic downgrade -1
uv run alembic upgrade head
```
