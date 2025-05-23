import os

import typer

from letta.cli.cli import server
from letta.cli.cli_load import app as load_app

# disable composio print on exit
os.environ["COMPOSIO_DISABLE_VERSION_CHECK"] = "true"

app = typer.Typer(pretty_exceptions_enable=False)
app.command(name="server")(server)

app.add_typer(load_app, name="load")
