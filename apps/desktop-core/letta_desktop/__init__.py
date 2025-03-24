from dotenv import load_dotenv
from pathlib import Path
from os.path import join
import os
import sys
import threading
import asyncio
import uvicorn
import requests
import time
from argparse import ArgumentParser

letta_dir = Path.home() / ".letta"
dotenv_path = join(letta_dir, "env")

# Create env file and folder if they don't exist
Path(dotenv_path).parent.mkdir(parents=True, exist_ok=True)
Path(dotenv_path).touch(exist_ok=True)
load_dotenv(dotenv_path)

import pgserver
import pg8000  # noqa
from tiktoken_ext import openai_public  # noqa
import tiktoken_ext  # noqa
import tiktoken  # noqa
import pydantic.deprecated.decorator  # noqa
import datamodel_code_generator  # noqa
import opentelemetry  # noqa
import blib2to3.pgen2.tokenize  # noqa
import blib2to3.pgen2.parse  # noqa
import mcp  # noqa
import json


print("Initializing Letta Desktop Service...")

def get_desktop_config():
  # Desktop config is a json located at ~/.letta/desktop_config.json

  desktop_config_path = letta_dir / "desktop_config.json"

  if not desktop_config_path.exists():
    return {}

  with open(desktop_config_path, "r") as f:
    return json.load(f)


def get_app_global_path():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    elif __file__:
        return os.path.dirname(__file__)


def wait_for_psql(database, timeout=30, delay=1):
    """Wait until the psql connection is available by repeatedly issuing a trivial query."""
    start_time = time.time()
    while True:
        try:
            database.psql("SELECT 1")
            print("Postgres connection is ready.")
            return
        except Exception as e:
            if time.time() - start_time > timeout:
                raise TimeoutError("Timeout waiting for Postgres psql connection to be available.")
            print("Waiting for Postgres connection to be ready...", e)
            time.sleep(delay)


def initialize_database():
    """Initialize the Postgres binary database with dynamic_library_path set to the bundled binaries."""
    pgdata = letta_dir / "desktop_data"
    pgdata.mkdir(parents=True, exist_ok=True)

    # Use the bundled Postgres binaries path from pgserver.
    from pgserver._commands import POSTGRES_BIN_PATH

    lib_dir = POSTGRES_BIN_PATH

    try:
        database = pgserver.get_server(pgdata)

        # Wait until the server socket file is present.
        socket_file = pgdata / ".s.PGSQL.5432"
        timeout = 30
        start_time = time.time()
        while not socket_file.exists():
            if time.time() - start_time > timeout:
                raise TimeoutError("Timeout waiting for Postgres server socket.")
            print("Waiting for server socket file to appear...")
            time.sleep(0.5)

        # Now wait for the connection to be ready.
        wait_for_psql(database, timeout=30, delay=1)

        # Set the dynamic_library_path to include the bundled binary path and the default $libdir.
        print(f"Setting dynamic_library_path to '{lib_dir},$libdir'")
        database.psql(f"ALTER SYSTEM SET dynamic_library_path = '{lib_dir},$libdir'")
        # Reload configuration so the new setting takes effect.
        database.psql("SELECT pg_reload_conf()")

        # Only create the extension if it doesn't exist.
        ext_check = database.psql("SELECT extname FROM pg_extension WHERE extname = 'vector'")
        if not ext_check or "vector" not in str(ext_check):
            print("Creating vector extension...")
            database.psql("CREATE EXTENSION vector")
        else:
            print("Vector extension already exists, skipping creation.")

        print("Database initialized at", pgdata)
    except Exception as e:
        print("Database initialization failed:", e)
        raise e

    print("Configuring app with database URI...")
    pg_uri = database.get_uri()
    with open(letta_dir / "pg_uri", "w") as f:
        f.write(pg_uri)
    return pg_uri


def upgrade_db(pg_uri):
    from alembic import command
    from alembic.config import Config

    alembic_cfg = Config(str(letta_dir / "migrations" / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(letta_dir / "migrations" / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", pg_uri)
    command.upgrade(alembic_cfg, "head")
    print("Database upgraded")


argparser = ArgumentParser()
argparser.add_argument("--look-for-server-id", type=str, help="Look for server id")
argparser.add_argument("--use-file-pg-uri", action="store_true")


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
    sys.exit(1)


def check_if_web_server_running():
    print("Checking if web server is running...")
    while True:
        try:
            res = requests.get("http://localhost:8285/health", timeout=5)
            res.raise_for_status()
            args = argparser.parse_args()
            if args.look_for_server_id and args.look_for_server_id not in res.text:
                print("Server id not found in response text, exiting...")
                kill_app()
            time.sleep(5)
        except Exception as e:
            print("Web server is down, exiting...")
            kill_app()


if __name__ == "__main__":
    config = get_desktop_config()

    try:
      if config['databaseConfig']['type'] != 'embedded':
        connection_string = config['databaseConfig']['connectionString']
        with open(letta_dir / "pg_uri", "w") as f:
          f.write(connection_string)

        upgrade_db(connection_string)
      else:
        pg_uri = initialize_database()
        upgrade_db(pg_uri)
    except KeyError:
        pg_uri = initialize_database()
        upgrade_db(pg_uri)



    from letta.server.rest_api.app import app

    print("Starting letta server...")
    config = uvicorn.Config(app, host="localhost", port=8283)
    server = ThreadedUvicorn(config)
    server.start()
    check_if_web_server_running()
