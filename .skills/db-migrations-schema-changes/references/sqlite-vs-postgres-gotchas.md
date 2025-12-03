# SQLite vs Postgres gotchas (letta-cloud core)

## SQLite limitations

SQLite has limited support for `ALTER TABLE`, especially around constraints and
foreign keys. In Alembic this often shows up as:

- `NotImplementedError: No support for ALTER of constraints in SQLite dialect...`

In `apps/core`, you may hit this when running migrations against SQLite that
drop or change foreign keys or constraints.

### How to handle

- Prefer running schema-changing migrations against Postgres by setting
  `LETTA_PG_URI` and using:

  ```bash
  uv run alembic upgrade head
  ```

- If you must support SQLite, use Alembic batch mode patterns, but for this
  project most complex migrations should target Postgres.

## Autogenerate differences

Running `alembic revision --autogenerate` against SQLite vs Postgres can
produce different diffs (especially around indexes and constraints).

Recommendations:

- For production/real migrations, always autogenerate against Postgres.
- If you see lots of unexpected index drops/adds, confirm which engine the
  migration is inspecting and rerun with Postgres.

## Engine selection reminder

- Engine is controlled by `letta.settings.DatabaseChoice` and environment
  (notably `LETTA_PG_URI`).
- `just ready` will also run migrations; ensure your desired engine is set
  before relying on its database steps.
