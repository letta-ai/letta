from typing import TYPE_CHECKING

from fastapi import APIRouter

from letta import __version__
from letta.schemas.health import Health

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", response_model=Health, operation_id="check_health")
async def check_health():
    """Async health check endpoint."""
    return Health(
        version=__version__,
        status="ok",
    )
