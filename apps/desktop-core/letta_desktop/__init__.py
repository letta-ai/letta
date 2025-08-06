from dotenv import load_dotenv
from pathlib import Path
from os.path import join
import os
import sys
import threading
import asyncio
import uvicorn
import urllib.parse
import requests
import time
import platform
import subprocess
from argparse import ArgumentParser

letta_dir = Path.home() / ".letta"
dotenv_path = join(letta_dir, "env")

# Create env file and folder if they don't exist
Path(dotenv_path).parent.mkdir(parents=True, exist_ok=True)
Path(dotenv_path).touch(exist_ok=True)
load_dotenv(dotenv_path)

# import pgserver
import pg8000  # noqa
from tiktoken_ext import openai_public  # noqa
import tiktoken_ext  # noqa
import tiktoken  # noqa
import pydantic.deprecated.decorator  # noqa
import datamodel_code_generator  # noqa
import opentelemetry  # noqa
import blib2to3.pgen2.tokenize  # noqa
import blib2to3.pgen2.parse  # noqa
import async_lru # noqa
import mcp  # noqa
import e2b # noqa
import asyncpg # noqa
import aiosqlite # noqa
import markitdown # noqa
import magika # noqa
import pgvector # noqa
import pgvector.sqlalchemy # noqa
import json


# Only print initialization messages if we're actually starting the server
# Check if we're being called as a script executor
is_script_execution = len(sys.argv) > 1 and sys.argv[1].endswith('.py') and os.path.isfile(sys.argv[1])
if not is_script_execution:
    print("Initializing Letta Desktop Service...", flush=True)
    print(f"Python version: {sys.version}", flush=True)


def get_desktop_config():
    # Desktop config is a json located at ~/.letta/desktop_config.json

    desktop_config_path = letta_dir / "desktop_config.json"

    if not desktop_config_path.exists():
        return {}

    with open(desktop_config_path, "r") as f:
        return json.load(f)


def initialize_database():
    pg_uri_path = letta_dir / "pg_uri"
    if not pg_uri_path.exists():
        raise RuntimeError("Expected pg_uri file to exist (written by Electron app)")

    with open(pg_uri_path, "r") as f:
        pg_uri_string = f.read().strip()

    print("Connecting to Postgres at", pg_uri_string, flush=True)

    # Parse URI into connection parameters.
    parsed = urllib.parse.urlparse(pg_uri_string)
    username = parsed.username or "postgres"
    password = parsed.password
    host = parsed.hostname or "localhost"
    port = parsed.port or 5433
    dbname = parsed.path.lstrip("/") or "postgres"

    # Log key environment information.
    print(f"Environment PATH: {os.environ.get('PATH')}", flush=True)
    print(f"Current working directory: {os.getcwd()}", flush=True)

    # Retry logic for connection
    retries = 5
    delay = 2  # seconds between retries
    for attempt in range(1, retries + 1):
        try:
            conn = pg8000.connect(user=username, password=password, host=host, port=port, database=dbname)
            print(f"Successfully connected to Postgres on attempt {attempt}", flush=True)
            break
        except Exception as e:
            print(f"Attempt {attempt} to connect to Postgres failed: {e}", flush=True)
            if attempt < retries:
                time.sleep(delay)
            else:
                print(f"FATAL: Could not connect to Postgres instance running at {pg_uri_string} after {retries} attempts.", flush=True)
                sys.exit(1)

    # Create the pgvector extension if not already present.
    try:
        cursor = conn.cursor()
        print("Attempting to create pgvector extension...", flush=True)
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"FATAL: Failed to create pgvector extension: {e}", flush=True)
        sys.exit(1)

    # Verify that the extension works.
    try:
        cursor = conn.cursor()
        print("Testing pgvector functionality...", flush=True)
        cursor.execute("CREATE TEMP TABLE test_vector(vec vector(3));")
        cursor.close()
    except Exception as e:
        print(f"FATAL: pgvector extension exists but is not functioning properly: {e}", flush=True)
        sys.exit(1)

    print("Database is ready and pgvector is available", flush=True)
    return pg_uri_string


def upgrade_db(db_uri=None):
    from alembic import command
    from alembic.config import Config

    # If no URI provided, use SQLite default
    if db_uri is None:
        db_uri = f"sqlite:///{letta_dir / 'sqlite.db'}"
        print(f"Running migrations for SQLite database: {db_uri}", flush=True)
    else:
        print(f"Running migrations for database: {db_uri}", flush=True)

    alembic_cfg = Config(str(letta_dir / "migrations" / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(letta_dir / "migrations" / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_uri)

    try:
        command.upgrade(alembic_cfg, "head")
        print("Database upgraded successfully", flush=True)
    except Exception as e:
        error_msg = str(e)
        if "already exists" in error_msg and "sqlite" in db_uri.lower():
            print("\n" + "="*60, flush=True)
            print("DATABASE MIGRATION ERROR", flush=True)
            print("="*60, flush=True)
            print(f"Error: {error_msg}", flush=True)
            print("\nThis error typically occurs when your SQLite database was created", flush=True)
            print("by an older version of Letta Desktop that didn't track migrations.", flush=True)
            print("\nRECOMMENDED SOLUTION:", flush=True)
            print(f"Delete your SQLite database at: {letta_dir / 'sqlite.db'}", flush=True)
            print("The database will be recreated with proper migration tracking.", flush=True)
            print("\nWARNING: This will reset your local Letta data.", flush=True)
            print("="*60 + "\n", flush=True)
        raise


argparser = ArgumentParser()
argparser.add_argument("--look-for-server-id", type=str, help="Look for server id")
argparser.add_argument("--use-file-pg-uri", action="store_true")
argparser.add_argument("--no-generation", action="store_true", help="Disable generation features")


class ThreadedUvicorn:
    def __init__(self, config: uvicorn.Config):
        self.server = uvicorn.Server(config)
        self.thread = threading.Thread(daemon=True, target=self.server.run)

    def start(self):
        self.thread.start()
        asyncio.run(self.wait_for_started())

    async def wait_for_started(self):
        while not self.server.started:
            await asyncio.sleep(0.1)

    def stop(self):
        if self.thread.is_alive():
            self.server.should_exit = True
            while self.thread.is_alive():
                continue


server = None


def kill_app():
    if server:
        server.stop()

    # Safely try to kill only the Postgres process we started
    postgres_pid_file = Path.home() / ".letta" / "postgres_pid"
    if postgres_pid_file.exists():
        try:
            pid = int(postgres_pid_file.read_text().strip())
            print(f"Attempting to kill Postgres PID: {pid}", flush=True)

            # Kill that specific PID rather than all processes named "postgres"
            if platform.system().lower().startswith("win"):
                subprocess.run(["taskkill", "/F", "/PID", str(pid)])
            else:
                subprocess.run(["kill", "-9", str(pid)])
        except Exception as e:
            print(f"Failed to kill Postgres by PID: {e}", flush=True)

    sys.exit(1)


def check_if_web_server_running():
    print("Checking if web server is running...", flush=True)
    while True:
        try:
            res = requests.get("http://localhost:8285/health", timeout=5)
            res.raise_for_status()
            args = argparser.parse_args()
            if args.look_for_server_id and args.look_for_server_id not in res.text:
                print("Server id not found in response text, exiting...", flush=True)
                kill_app()
            time.sleep(5)
        except Exception as e:
            print("Web server is down, exiting...", flush=True)
            kill_app()


if __name__ == "__main__":
    # Check if we're being called to execute a Python script (tool execution)
    # This happens when sys.executable (the bundled app) is used to run a tool
    if len(sys.argv) > 1 and sys.argv[1].endswith('.py') and os.path.isfile(sys.argv[1]):
        # Execute the script instead of starting the server
        script_path = sys.argv[1]

        # Update sys.argv to remove the script path and shift arguments
        # This makes the script think it was called directly
        original_argv = sys.argv[:]
        sys.argv = [script_path] + sys.argv[2:]

        # Execute the script in the current Python environment
        try:
            with open(script_path, 'r') as f:
                script_content = f.read()
            exec(compile(script_content, script_path, 'exec'), {'__name__': '__main__', '__file__': script_path})
        except Exception as e:
            # Print the error and exit with non-zero status
            import traceback
            traceback.print_exc()
            sys.exit(1)

        # Exit successfully if script completed
        sys.exit(0)

    config = get_desktop_config()

    # CRITICAL: Handle pg_uri file BEFORE any Letta imports
    # The settings module reads pg_uri on import, so we must delete it first
    try:
      database_config = config.get("databaseConfig", {})
      pg_uri_path = letta_dir / "pg_uri"

      # Debug: Check command line arguments
      print(f"Command line arguments: {sys.argv}", flush=True)
      print(f"Database config: type={database_config.get('type')}, embeddedType={database_config.get('embeddedType', 'N/A')}", flush=True)

      # Check for database-related environment variables
      env_vars_to_check = ['LETTA_PG_URI', 'LETTA_PG_HOST', 'LETTA_PG_PORT', 'LETTA_PG_DB', 'LETTA_PG_USER', 'LETTA_PG_PASSWORD']
      for var in env_vars_to_check:
          if var in os.environ:
              print(f"Found environment variable: {var}={os.environ[var]}", flush=True)

      if database_config.get("type") == "embedded" and database_config.get("embeddedType") == "sqlite":
        # SQLite configuration - ensure pg_uri file doesn't interfere
        if pg_uri_path.exists():
          print("SQLite configured but pg_uri file exists - removing to prevent conflicts", flush=True)
          pg_uri_path.unlink()
          print("pg_uri file successfully deleted", flush=True)

        # Also clear any PostgreSQL environment variables that would override SQLite
        pg_env_vars = ['LETTA_PG_URI', 'LETTA_PG_HOST', 'LETTA_PG_PORT', 'LETTA_PG_DB', 'LETTA_PG_USER', 'LETTA_PG_PASSWORD']
        for var in pg_env_vars:
          if var in os.environ:
            print(f"Clearing PostgreSQL environment variable: {var}", flush=True)
            del os.environ[var]

      # Now handle the database setup
      print(f"Database setup - type: {database_config.get('type')}, embeddedType: {database_config.get('embeddedType', 'N/A')}", flush=True)

      if database_config.get("type") != "embedded":
        connection_string = database_config.get("connectionString", "")
        if connection_string:
          print(f"Using external database with connection string", flush=True)
          with open(pg_uri_path, "w") as f:
            f.write(connection_string)
          upgrade_db(connection_string)
      elif database_config.get("type") == "embedded" and database_config.get("embeddedType") != "sqlite":
        print(f"Using embedded PostgreSQL database", flush=True)
        pg_uri = initialize_database()
        upgrade_db(pg_uri)
      elif database_config.get("type") == "embedded" and database_config.get("embeddedType") == "sqlite":
        # Run migrations for SQLite
        print(f"Using embedded SQLite database", flush=True)
        upgrade_db()  # Will use default SQLite path
    except KeyError:
      # Default to SQLite if no config - also run migrations
      print("No database config found, defaulting to SQLite", flush=True)
      upgrade_db()  # Will use default SQLite path


    from letta.server.rest_api.app import app

    print("Starting the Letta Server...")
    config = uvicorn.Config(app, host="localhost", port=8283)
    server = ThreadedUvicorn(config)
    server.start()
    check_if_web_server_running()
