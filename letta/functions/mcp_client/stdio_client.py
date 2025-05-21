import asyncio
import sys
from contextlib import asynccontextmanager

import anyio
import anyio.lowlevel
import mcp.types as types
from anyio.streams.text import TextReceiveStream
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import get_default_environment

from letta.functions.mcp_client.base_client import BaseMCPClient
from letta.functions.mcp_client.types import StdioServerConfig
from letta.log import get_logger

logger = get_logger(__name__)


class StdioMCPClient(BaseMCPClient):
    def _initialize_connection(self, server_config: StdioServerConfig, timeout: float) -> bool:
        try:
            server_params = StdioServerParameters(command=server_config.command, args=server_config.args, env=server_config.env)
            stdio_cm = forked_stdio_client(server_params)
            stdio_transport = self.loop.run_until_complete(asyncio.wait_for(stdio_cm.__aenter__(), timeout=timeout))
            self.stdio, self.write = stdio_transport
            self.cleanup_funcs.append(lambda: self.loop.run_until_complete(stdio_cm.__aexit__(None, None, None)))

            session_cm = ClientSession(self.stdio, self.write)
            self.session = self.loop.run_until_complete(asyncio.wait_for(session_cm.__aenter__(), timeout=timeout))
            self.cleanup_funcs.append(lambda: self.loop.run_until_complete(session_cm.__aexit__(None, None, None)))
            return True
        except asyncio.TimeoutError:
            logger.error(f"Timed out while establishing stdio connection (timeout={timeout}s).")
            return False
        except Exception:
            logger.exception("Exception occurred while initializing stdio client session.")
            return False


@asynccontextmanager
async def forked_stdio_client(server: StdioServerParameters):
    """
    Client transport for stdio: this will connect to a server by spawning a
    process and communicating with it over stdin/stdout.
    """
    read_stream_writer, read_stream = anyio.create_memory_object_stream(0)
    write_stream, write_stream_reader = anyio.create_memory_object_stream(0)

    try:
        process = await anyio.open_process(
            [server.command, *server.args],
            env=server.env or get_default_environment(),
            stderr=sys.stderr,  # Consider logging stderr somewhere instead of silencing it
        )
    except OSError as exc:
        raise RuntimeError(f"Failed to spawn process: {server.command} {server.args}") from exc

    async def stdout_reader():
        assert process.stdout, "Opened process is missing stdout"
        buffer = ""
        try:
            async with read_stream_writer:
                async for chunk in TextReceiveStream(
                    process.stdout,
                    encoding=server.encoding,
                    errors=server.encoding_error_handler,
                ):
                    lines = (buffer + chunk).split("\n")
                    buffer = lines.pop()
                    for line in lines:
                        try:
                            message = types.JSONRPCMessage.model_validate_json(line)
                        except Exception as exc:
                            await read_stream_writer.send(exc)
                            continue
                        await read_stream_writer.send(message)
        except anyio.ClosedResourceError:
            await anyio.lowlevel.checkpoint()

    async def stdin_writer():
        assert process.stdin, "Opened process is missing stdin"
        try:
            async with write_stream_reader:
                async for message in write_stream_reader:
                    json = message.model_dump_json(by_alias=True, exclude_none=True)
                    await process.stdin.send(
                        (json + "\n").encode(
                            encoding=server.encoding,
                            errors=server.encoding_error_handler,
                        )
                    )
        except anyio.ClosedResourceError:
            await anyio.lowlevel.checkpoint()

    async def watch_process_exit():
        returncode = await process.wait()
        if returncode != 0:
            raise RuntimeError(f"Subprocess exited with code {returncode}. Command: {server.command} {server.args}")

    async with anyio.create_task_group() as tg, process:
        tg.start_soon(stdout_reader)
        tg.start_soon(stdin_writer)
        tg.start_soon(watch_process_exit)

        with anyio.move_on_after(0.2):
            await anyio.sleep_forever()

        yield read_stream, write_stream
