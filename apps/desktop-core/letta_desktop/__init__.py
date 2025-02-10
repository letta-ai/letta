from dotenv import load_dotenv
from pathlib import Path
from os.path import join
letta_dir = Path.home() / ".letta"
from threading import Thread

dotenv_path = join(letta_dir, "env")

# make env file and folder if it doesn't exist
Path(dotenv_path).parent.mkdir(parents=True, exist_ok=True)

# make file if it doesn't exist
Path(dotenv_path).touch(exist_ok=True)

load_dotenv(dotenv_path)

import os
import sys
import pgserver
import pg8000 # noqa
from tiktoken_ext import openai_public # noqa
import tiktoken_ext # noqa
import tiktoken # noqa
import pydantic.deprecated.decorator # noqa

# read first argument

pg_uri = ''

print("Initializing Letta Desktop Service...")

def get_app_global_path():
  if getattr(sys, 'frozen', False):
    return os.path.dirname(sys.executable)
  elif __file__:
    return os.path.dirname(__file__)

def initialize_database():
  """Initialize the postgres binary database"""
  # create the pgdata
  pgdata = letta_dir / 'desktop_data'
  pgdata.mkdir(parents=True, exist_ok=True)

  try:
    database = pgserver.get_server(pgdata)
    # create pg vector extension
    database.psql('CREATE EXTENSION IF NOT EXISTS vector')
    print("Database initialized at %s", pgdata)
  except Exception as e:
    print("Database initialization failed: %s", e)
    raise e
  print("Configuring app with database uri...")

  pg_uri = database.get_uri()
  print('Saving pg_uri to ~/.letta/pg_uri')

  # save uri to ~/.letta/pg_uri
  with open(letta_dir / 'pg_uri', 'w') as f:
    f.write(pg_uri)

def upgrade_db():
  from alembic import command
  from alembic.config import Config

  alembic_cfg = Config(str(letta_dir / 'migrations' / 'alembic.ini'))
  alembic_cfg.set_main_option('script_location', str(letta_dir / 'migrations' / 'alembic'))
  alembic_cfg.set_main_option('sqlalchemy.url', pg_uri)
  command.upgrade(alembic_cfg, 'head')

  print('Database upgraded')


def check_if_web_server_running():
  # ping localhost:8285 every 5 seconds, if its down kill this process
  import requests
  import time
  print("Checking if web server is running...")

  while True:
    try:
      print("Pinging localhost:8285")
      res = requests.get('http://localhost:8285/health', timeout=5)
      res.raise_for_status()
      time.sleep(5)
    except Exception as e:
      print("Web server is down, exiting...")
      sys.exit(1)


if __name__ == "__main__":
  initialize_database()
  upgrade_db()

  from letta.server.rest_api.app import start_server

  print("Starting server...")

  # start the server in a separate thread
  server_thread = Thread(target=start_server)
  server_thread.start()

  check_if_web_server_running()
