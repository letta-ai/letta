from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class CheckPasswordMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, password: str):
        super().__init__(app)
        self.password = password

    async def dispatch(self, request, call_next):
        # Exclude health check endpoint from password protection
        if request.url.path in {"/v1/health", "/v1/health/", "/latest/health/"}:
            return await call_next(request)

        if (
            request.headers.get("X-BARE-PASSWORD") == f"password {self.password}"
            or request.headers.get("Authorization") == f"Bearer {self.password}"
        ):
            return await call_next(request)

        return JSONResponse(
            content={"detail": "Unauthorized"},
            status_code=401,
        )
