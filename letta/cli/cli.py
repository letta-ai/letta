import sys
from enum import Enum
from typing import Annotated, Optional

import typer

from letta.log import get_logger
from letta.streaming_interface import StreamingRefreshCLIInterface as interface  # for printing to terminal

logger = get_logger(__name__)


class ServerChoice(Enum):
    rest_api = "rest"
    ws_api = "websocket"


def server(
    type: Annotated[ServerChoice, typer.Option(help="Server to run")] = "rest",
    port: Annotated[Optional[int], typer.Option(help="Port to run the server on")] = None,
    host: Annotated[Optional[str], typer.Option(help="Host to run the server on (default to localhost)")] = None,
    debug: Annotated[bool, typer.Option(help="Turn debugging output on")] = False,
    reload: Annotated[bool, typer.Option(help="Enable hot-reload")] = False,
    ade: Annotated[bool, typer.Option(help="Allows remote access")] = False,  # NOTE: deprecated
    secure: Annotated[bool, typer.Option(help="Adds simple security access")] = False,
    localhttps: Annotated[bool, typer.Option(help="Setup local https")] = False,
):
    """Launch a Letta server process"""
    if type == ServerChoice.rest_api:
        pass

        try:
            from letta.server.rest_api.app import start_server

            start_server(port=port, host=host, debug=debug, reload=reload)

        except KeyboardInterrupt:
            # Handle CTRL-C
            typer.secho("Terminating the server...")
            sys.exit(0)

    elif type == ServerChoice.ws_api:
        raise NotImplementedError("WS suppport deprecated")


def version() -> str:
    import letta

    print(letta.__version__)
