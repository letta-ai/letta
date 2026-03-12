from fastapi import FastAPI
from fastapi.responses import RedirectResponse


def mount_static_files(app: FastAPI):
    @app.get("/", include_in_schema=False)
    async def redirect_to_docs():
        return RedirectResponse(url="/docs")
