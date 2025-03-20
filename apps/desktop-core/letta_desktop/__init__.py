from dotenv import load_dotenv
from pathlib import Path
from os.path import join

letta_dir = Path.home() / ".letta"
import threading
from argparse import ArgumentParser

dotenv_path = join(letta_dir, "env")

# make env file and folder if it doesn't exist
Path(dotenv_path).parent.mkdir(parents=True, exist_ok=True)

# make file if it doesn't exist
Path(dotenv_path).touch(exist_ok=True)

load_dotenv(dotenv_path)

import os
import sys
import pgserver
import pg8000  # noqa
from tiktoken_ext import openai_public  # noqa
import tiktoken_ext  # noqa
import tiktoken  # noqa
import pydantic.deprecated.decorator  # noqa
import datamodel_code_generator  # noqa
import opentelemetry  # noqa
import asyncio
import uvicorn
from uvicorn import Config
import blib2to3.pgen2.tokenize  # noqa
import blib2to3.pgen2.parse  # noqa
import mcp  # noqa

# read first argument

pg_uri = ""

print("Initializing Letta Desktop Service...")


def get_app_global_path():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    elif __file__:
        return os.path.dirname(__file__)


def initialize_database():
    """Initialize the postgres binary database"""
    # create the pgdata
    pgdata = letta_dir / "desktop_data"
    pgdata.mkdir(parents=True, exist_ok=True)

    try:
        database = pgserver.get_server(pgdata)
        # create pg vector extension
        database.psql("CREATE EXTENSION IF NOT EXISTS vector")
        print("Database initialized at %s", pgdata)
    except Exception as e:
        print("Database initialization failed: %s", e)
        raise e
    print("Configuring app with database uri...")

    pg_uri = database.get_uri()
    print("Saving pg_uri to ~/.letta/pg_uri")

    # save uri to ~/.letta/pg_uri
    with open(letta_dir / "pg_uri", "w") as f:
        f.write(pg_uri)


def upgrade_db():
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
    def __init__(self, config: Config):
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
    # ping localhost:8285 every 5 seconds, if its down kill this process
    import requests
    import time

    print("Checking if web server is running...")

    while True:
        try:
            res = requests.get("http://localhost:8285/health", timeout=5)
            res.raise_for_status()

            # extract server id from args --look-for-server-id={value}
            args = argparser.parse_args()

            if args.look_for_server_id:
                # get response text
                response_text = res.text

                # if the response text does not contain the server id, kill the process, throw an error
                if args.look_for_server_id not in response_text:
                    print("Server id not found in response text, exiting...")
                    kill_app()

            time.sleep(5)
        except Exception as e:
            print("Web server is down, exiting...")
            kill_app()


if __name__ == "__main__":
    initialize_database()
    upgrade_db()

    from letta.server.rest_api.app import app

    print("Starting letta server...")

    # start the server in a separate thread
    config = Config(app, host="localhost", port=8283)

    server = ThreadedUvicorn(config)

    server.start()
    check_if_web_server_running()
