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


def initialize_database():
    pg_uri_path = letta_dir / "pg_uri"
    if not pg_uri_path.exists():
        raise RuntimeError("Expected pg_uri file to exist (written by Electron app)")

    with open(pg_uri_path, "r") as f:
        pg_uri_string = f.read().strip()

    print("Connecting to Postgres at", pg_uri_string)

    # Parse URI into connection parameters.
    parsed = urllib.parse.urlparse(pg_uri_string)
    username = parsed.username or "postgres"
    password = parsed.password
    host = parsed.hostname or "localhost"
    port = parsed.port or 5433
    dbname = parsed.path.lstrip("/") or "postgres"

    # Log key environment information.
    print(f"Environment PATH: {os.environ.get('PATH')}")
    print(f"Current working directory: {os.getcwd()}")

    # Retry logic for connection
    retries = 5
    delay = 2  # seconds between retries
    for attempt in range(1, retries + 1):
        try:
            conn = pg8000.connect(user=username, password=password, host=host, port=port, database=dbname)
            print(f"Successfully connected to Postgres on attempt {attempt}")
            break
        except Exception as e:
            print(f"Attempt {attempt} to connect to Postgres failed: {e}")
            if attempt < retries:
                time.sleep(delay)
            else:
                print(f"FATAL: Could not connect to Postgres instance running at {pg_uri_string} after {retries} attempts.")
                sys.exit(1)

    # Create the pgvector extension if not already present.
    try:
        cursor = conn.cursor()
        print("Attempting to create pgvector extension...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"FATAL: Failed to create pgvector extension: {e}")
        sys.exit(1)

    # Verify that the extension works.
    try:
        cursor = conn.cursor()
        print("Testing pgvector functionality...")
        cursor.execute("CREATE TEMP TABLE test_vector(vec vector(3));")
        cursor.close()
    except Exception as e:
        print(f"FATAL: pgvector extension exists but is not functioning properly: {e}")
        sys.exit(1)

    print("Database is ready and pgvector is available")
    return pg_uri_string


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

    # Safely try to kill only the Postgres process we started
    postgres_pid_file = Path.home() / ".letta" / "postgres_pid"
    if postgres_pid_file.exists():
        try:
            pid = int(postgres_pid_file.read_text().strip())
            print(f"Attempting to kill Postgres PID: {pid}")

            # Kill that specific PID rather than all processes named "postgres"
            if platform.system().lower().startswith("win"):
                subprocess.run(["taskkill", "/F", "/PID", str(pid)])
            else:
                subprocess.run(["kill", "-9", str(pid)])
        except Exception as e:
            print(f"Failed to kill Postgres by PID: {e}")

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
        if config["databaseConfig"]["type"] != "embedded":
            connection_string = config["databaseConfig"]["connectionString"]
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

    print("Starting the Letta Server...")
    config = uvicorn.Config(app, host="localhost", port=8283)
    server = ThreadedUvicorn(config)
    server.start()
    check_if_web_server_running()
