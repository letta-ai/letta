# External Database Setup for Letta

This directory contains scripts and configuration for setting up an external database for Letta.

## Prerequisites

- Python 3.8+ with `python-dotenv` package
- Access to the external database credentials

## Environment Setup

1. Copy `.env.external-database-init` to `.env` and update the values:
```bash
cp .env.external-database-init .env
```

2. Edit `.env` with your database credentials:
```
# Admin credentials for database initialization
POSTGRES_ADMIN_USER=<admin_user>
POSTGRES_ADMIN_PASSWORD=<admin_password>
POSTGRES_APPLICATION_USER=<new_application_user>
POSTGRES_APPLICATION_PASSWORD=<new_application_password>
POSTGRES_DB=<application_database>  # If can exist
POSTGRES_SCHEMA=<application_schema> # If can exist
POSTGRES_HOST=<database_host>
POSTGRES_PORT=<database_password>
```

## Database Initialization

To initialize the database with the required schema and extensions:

```bash
# Run the initialization script (you may need to run it twice)
poetry poetry run scripts/external-database/init_external_db.py
```

This will:
1. Create the database if it doesn't exist
2. Set up the required schema
3. Create necessary extensions
4. Configure permissions for the application user and admin user

## Running Migrations Manually

Before you run the migrations manually, make sure that you have the right env variables on your .env file.

```bash
...
LETTA_PG_USER=<application_user_password>
LETTA_PG_PASSWORD=<application_user_password>
LETTA_PG_DB=<database> # Default schema for the application user has been set as part of the database initialisation.
LETTA_PG_HOST=<database_hostname>
LETTA_PG_PORT=<database_port>
...
```

To run migrations manually:

1. First, ensure you're in the project root directory:
```bash
cd /path/to/letta
```

2. Run the migration command:
```bash
# Upgrade to latest version
poetry run alembic upgrade head 
```