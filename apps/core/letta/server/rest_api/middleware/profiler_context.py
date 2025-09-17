from starlette.middleware.base import BaseHTTPMiddleware


class ProfilerContextMiddleware(BaseHTTPMiddleware):
    """Middleware to set context if using profiler. Currently just uses google-cloud-profiler."""

    async def dispatch(self, request, call_next):
        ctx = None
        if request.url.path in {"/v1/health", "/v1/health/"}:
            return await call_next(request)
        try:
            labels = {
                "method": request.method,
                "path": request.url.path,
                "endpoint": request.url.path,
            }
            import googlecloudprofiler

            ctx = googlecloudprofiler.context.set_labels(**labels)
        except:
            return await call_next(request)
        if ctx:
            with ctx:
                return await call_next(request)
        return await call_next(request)
