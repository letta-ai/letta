from letta.settings import settings
from pathlib import Path
import os
import sys
import pgserver
import pg8000 # noqa
from tiktoken_ext import openai_public # noqa
import tiktoken_ext # noqa
import tiktoken # noqa

# read first argument

def get_app_global_path():
  if getattr(sys, 'frozen', False):
    return os.path.dirname(sys.executable)
  elif __file__:
    return os.path.dirname(__file__)

def initialize_database():
  """Initialize the postgres binary database"""
  # create the pgdata
  pgdata = settings.letta_dir / "data"
  pgdata.mkdir(parents=True, exist_ok=True)

  try:
    database = pgserver.get_server(pgdata)
    # create pg vector extension
    database.psql('CREATE EXTENSION IF NOT EXISTS vector')
    print("Database initialized at %s", pgdata)
  except Exception as e:
    print("Database initialization failed: %s", e)
    raise e
  print("Configuring app with databsase uri...")

  settings.pg_uri = database.get_uri()
  print("Database URI: %s configured in settings", settings.pg_uri)

def upgrade_db():
  from alembic import command
  from alembic.config import Config

  alembic_cfg = Config(str(settings.letta_dir / 'migrations' / 'alembic.ini'))
  alembic_cfg.set_main_option('script_location', str(settings.letta_dir / 'migrations' / 'alembic'))
  alembic_cfg.set_main_option('sqlalchemy.url', settings.letta_pg_uri)
  command.upgrade(alembic_cfg, 'head')

  print('Database upgraded')



if __name__ == "__main__":
  initialize_database()
  upgrade_db()

  from letta.server.rest_api.app import start_server

  print("Starting server...")

  start_server()
