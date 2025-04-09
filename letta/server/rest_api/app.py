import asyncio
import concurrent.futures
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from letta.__init__ import __version__
from letta.constants import ADMIN_PREFIX, API_PREFIX, OPENAI_API_PREFIX
from letta.errors import BedrockPermissionError, LettaAgentNotFoundError, LettaUserNotFoundError
from letta.jobs.scheduler import shutdown_cron_scheduler, start_cron_jobs
from letta.log import get_logger
from letta.orm.errors import DatabaseTimeoutError, ForeignKeyConstraintViolationError, NoResultFound, UniqueConstraintViolationError
from letta.schemas.letta_message import create_letta_message_union_schema
from letta.schemas.letta_message_content import (
    create_letta_assistant_message_content_union_schema,
    create_letta_message_content_union_schema,
    create_letta_user_message_content_union_schema,
)
from letta.server.constants import REST_DEFAULT_PORT

# NOTE(charles): these are extra routes that are not part of v1 but we still need to mount to pass tests
from letta.server.rest_api.auth.index import setup_auth_router  # TODO: probably remove right?
from letta.server.rest_api.interface import StreamingServerInterface
from letta.server.rest_api.routers.openai.chat_completions.chat_completions import router as openai_chat_completions_router

# from letta.orm.utilities import get_db_session  # TODO(ethan) reenable once we merge ORM
from letta.server.rest_api.routers.v1 import ROUTERS as v1_routes
from letta.server.rest_api.routers.v1.organizations import router as organizations_router
from letta.server.rest_api.routers.v1.users import router as users_router  # TODO: decide on admin
from letta.server.rest_api.static_files import mount_static_files
from letta.server.server import SyncServer
from letta.settings import settings

# TODO(ethan)
# NOTE(charles): @ethan I had to add this to get the global as the bottom to work
interface: StreamingServerInterface = StreamingServerInterface
server = SyncServer(default_interface_factory=lambda: interface())
logger = get_logger(__name__)


import logging
import platform

from fastapi import FastAPI

is_windows = platform.system() == "Windows"

log = logging.getLogger("uvicorn")


def generate_openapi_schema(app: FastAPI):
    # Update the OpenAPI schema
    if not app.openapi_schema:
        app.openapi_schema = app.openapi()

    letta_docs = app.openapi_schema.copy()
    letta_docs["paths"] = {k: v for k, v in letta_docs["paths"].items() if not k.startswith("/openai")}
    letta_docs["info"]["title"] = "Letta API"
    letta_docs["components"]["schemas"]["LettaMessageUnion"] = create_letta_message_union_schema()
    letta_docs["components"]["schemas"]["LettaMessageContentUnion"] = create_letta_message_content_union_schema()
    letta_docs["components"]["schemas"]["LettaAssistantMessageContentUnion"] = create_letta_assistant_message_content_union_schema()
    letta_docs["components"]["schemas"]["LettaUserMessageContentUnion"] = create_letta_user_message_content_union_schema()

    for name, docs in [
        (
            "letta",
            letta_docs,
        ),
    ]:
        if settings.cors_origins:
            docs["servers"] = [{"url": host} for host in settings.cors_origins]
        Path(f"openapi_{name}.json").write_text(json.dumps(docs, indent=2))


# middleware that only allows requests to pass through if user provides a password thats randomly generated and stored in memory
def generate_password():
    import secrets

    return secrets.token_urlsafe(16)


random_password = os.getenv("LETTA_SERVER_PASSWORD") or generate_password()


class CheckPasswordMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request, call_next):

        # Exclude health check endpoint from password protection
        if request.url.path == "/v1/health/" or request.url.path == "/latest/health/":
            return await call_next(request)

        if (
            request.headers.get("X-BARE-PASSWORD") == f"password {random_password}"
            or request.headers.get("Authorization") == f"Bearer {random_password}"
        ):
            return await call_next(request)

        return JSONResponse(
            content={"detail": "Unauthorized"},
            status_code=401,
        )


def create_application() -> "FastAPI":
    """the application start routine"""
    # global server
    # server = SyncServer(default_interface_factory=lambda: interface())
    print(f"\n[[ Letta server // v{__version__} ]]")

    if (os.getenv("SENTRY_DSN") is not None) and (os.getenv("SENTRY_DSN") != ""):
        import sentry_sdk

        sentry_sdk.init(
            dsn=os.getenv("SENTRY_DSN"),
            traces_sample_rate=1.0,
            _experiments={
                "continuous_profiling_auto_start": True,
            },
        )

    debug_mode = "--debug" in sys.argv
    app = FastAPI(
        swagger_ui_parameters={"docExpansion": "none"},
        # openapi_tags=TAGS_METADATA,
        title="Letta",
        summary="Create LLM agents with long-term memory and custom tools 📚🦙",
        version="1.0.0",  # TODO wire this up to the version in the package
        debug=debug_mode,  # if True, the stack trace will be printed in the response
    )

    @app.on_event("startup")
    async def configure_executor():
        print(f"INFO:     Configured event loop executor with {settings.event_loop_threadpool_max_workers} workers.")
        loop = asyncio.get_running_loop()
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=settings.event_loop_threadpool_max_workers)
        loop.set_default_executor(executor)

    @app.on_event("startup")
    def on_startup():
        global server

        start_cron_jobs(server)

    @app.on_event("shutdown")
    def shutdown_mcp_clients():
        global server
        import threading

        def cleanup_clients():
            if hasattr(server, "mcp_clients"):
                for client in server.mcp_clients.values():
                    client.cleanup()
                server.mcp_clients.clear()

        t = threading.Thread(target=cleanup_clients)
        t.start()
        t.join()

    @app.on_event("shutdown")
    def shutdown_scheduler():
        shutdown_cron_scheduler()

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        # Log the actual error for debugging
        log.error(f"Unhandled error: {exc}", exc_info=True)

        # Print the stack trace
        print(f"Stack trace: {exc}")
        if (os.getenv("SENTRY_DSN") is not None) and (os.getenv("SENTRY_DSN") != ""):
            import sentry_sdk

            sentry_sdk.capture_exception(exc)

        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred",
                # Only include error details in debug/development mode
                # "debug_info": str(exc) if settings.debug else None
            },
        )

    @app.exception_handler(NoResultFound)
    async def no_result_found_handler(request: Request, exc: NoResultFound):
        logger.error(f"NoResultFound: {exc}")

        return JSONResponse(
            status_code=404,
            content={"detail": str(exc)},
        )

    @app.exception_handler(ForeignKeyConstraintViolationError)
    async def foreign_key_constraint_handler(request: Request, exc: ForeignKeyConstraintViolationError):
        logger.error(f"ForeignKeyConstraintViolationError: {exc}")

        return JSONResponse(
            status_code=409,
            content={"detail": str(exc)},
        )

    @app.exception_handler(UniqueConstraintViolationError)
    async def unique_key_constraint_handler(request: Request, exc: UniqueConstraintViolationError):
        logger.error(f"UniqueConstraintViolationError: {exc}")

        return JSONResponse(
            status_code=409,
            content={"detail": str(exc)},
        )

    @app.exception_handler(DatabaseTimeoutError)
    async def database_timeout_error_handler(request: Request, exc: DatabaseTimeoutError):
        logger.error(f"Timeout occurred: {exc}. Original exception: {exc.original_exception}")
        return JSONResponse(
            status_code=503,
            content={"detail": "The database is temporarily unavailable. Please try again later."},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(LettaAgentNotFoundError)
    async def agent_not_found_handler(request: Request, exc: LettaAgentNotFoundError):
        return JSONResponse(status_code=404, content={"detail": "Agent not found"})

    @app.exception_handler(LettaUserNotFoundError)
    async def user_not_found_handler(request: Request, exc: LettaUserNotFoundError):
        return JSONResponse(status_code=404, content={"detail": "User not found"})

    @app.exception_handler(BedrockPermissionError)
    async def bedrock_permission_error_handler(request, exc: BedrockPermissionError):
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "type": "bedrock_permission_denied",
                    "message": "Unable to access the required AI model. Please check your Bedrock permissions or contact support.",
                    "details": {"model_arn": exc.model_arn, "reason": str(exc)},
                }
            },
        )

    settings.cors_origins.append("https://app.letta.com")

    if (os.getenv("LETTA_SERVER_SECURE") == "true") or "--secure" in sys.argv:
        print(f"▶ Using secure mode with password: {random_password}")
        app.add_middleware(CheckPasswordMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Set up OpenTelemetry tracing
    otlp_endpoint = settings.otel_exporter_otlp_endpoint
    if otlp_endpoint and not settings.disable_tracing:
        print(f"▶ Using OTLP tracing with endpoint: {otlp_endpoint}")
        env_name_suffix = os.getenv("ENV_NAME")
        service_name = f"letta-server-{env_name_suffix.lower()}" if env_name_suffix else "letta-server"
        from letta.tracing import setup_tracing

        setup_tracing(
            endpoint=otlp_endpoint,
            app=app,
            service_name=service_name,
        )

    for route in v1_routes:
        app.include_router(route, prefix=API_PREFIX)
        # this gives undocumented routes for "latest" and bare api calls.
        # we should always tie this to the newest version of the api.
        # app.include_router(route, prefix="", include_in_schema=False)
        app.include_router(route, prefix="/latest", include_in_schema=False)

    # NOTE: ethan these are the extra routes
    # TODO(ethan) remove

    # admin/users
    app.include_router(users_router, prefix=ADMIN_PREFIX)
    app.include_router(organizations_router, prefix=ADMIN_PREFIX)

    # openai
    app.include_router(openai_chat_completions_router, prefix=OPENAI_API_PREFIX)

    # /api/auth endpoints
    app.include_router(setup_auth_router(server, interface, random_password), prefix=API_PREFIX)

    # / static files
    mount_static_files(app)

    @app.on_event("shutdown")
    def on_shutdown():
        global server
        # server = None

    return app


app = create_application()


def start_server(
    port: Optional[int] = None,
    host: Optional[str] = None,
    debug: bool = False,
):
    """Convenience method to start the server from within Python"""
    if debug:
        from letta.server.server import logger as server_logger

        # Set the logging level
        server_logger.setLevel(logging.DEBUG)
        # Create a StreamHandler
        stream_handler = logging.StreamHandler()
        # Set the formatter (optional)
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        stream_handler.setFormatter(formatter)
        # Add the handler to the logger
        server_logger.addHandler(stream_handler)

    if (os.getenv("LOCAL_HTTPS") == "true") or "--localhttps" in sys.argv:
        print(f"▶ Server running at: https://{host or 'localhost'}:{port or REST_DEFAULT_PORT}")
        print(f"▶ View using ADE at: https://app.letta.com/development-servers/local/dashboard\n")
        uvicorn.run(
            "letta.server.rest_api.app:app",
            host=host or "localhost",
            port=port or REST_DEFAULT_PORT,
            workers=settings.uvicorn_workers,
            reload=settings.uvicorn_reload,
            timeout_keep_alive=settings.uvicorn_timeout_keep_alive,
            ssl_keyfile="certs/localhost-key.pem",
            ssl_certfile="certs/localhost.pem",
        )
    else:
        if is_windows:
            # Windows doesn't those the fancy unicode characters
            print(f"Server running at: http://{host or 'localhost'}:{port or REST_DEFAULT_PORT}")
            print(f"View using ADE at: https://app.letta.com/development-servers/local/dashboard\n")
        else:
            print(f"▶ Server running at: http://{host or 'localhost'}:{port or REST_DEFAULT_PORT}")
            print(f"▶ View using ADE at: https://app.letta.com/development-servers/local/dashboard\n")

        uvicorn.run(
            "letta.server.rest_api.app:app",
            host=host or "localhost",
            port=port or REST_DEFAULT_PORT,
            workers=settings.uvicorn_workers,
            reload=settings.uvicorn_reload,
            timeout_keep_alive=settings.uvicorn_timeout_keep_alive,
        )
