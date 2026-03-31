from typing import TYPE_CHECKING

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from letta import __version__
from letta.schemas.health import Health

if TYPE_CHECKING:
    pass

router = APIRouter(tags=["health"])

# States that should cause readiness to return 503 when enforcement is enabled.
_UNREADY_STATES = {"degraded", "manual_disable", "warming"}


@router.get("/health/", response_model=Health, operation_id="check_health")
async def check_health():
    """Liveness endpoint; returns 200 when process is responsive."""
    return Health(version=__version__, status="ok")


@router.get("/ready/", response_model=Health, operation_id="check_readiness")
async def check_readiness():
    """Readiness endpoint gated by internal readiness state when enforcement is enabled."""
    from letta.settings import readiness_settings

    if not readiness_settings.enforcement_enabled:
        return Health(version=__version__, status="ok")

    from letta.monitoring.readiness_state import get_readiness_state

    state = get_readiness_state()

    # During drain we optionally return 503 so k8s stops new routing before termination.
    if state == "draining":
        if readiness_settings.drain_returns_503:
            return JSONResponse(status_code=503, content={"version": __version__, "status": "draining"})
        return Health(version=__version__, status="ok")

    if state in _UNREADY_STATES:
        return JSONResponse(status_code=503, content={"version": __version__, "status": state})

    return Health(version=__version__, status="ok")
