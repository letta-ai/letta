from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from letta.schemas.user import User, UserCreate, UserUpdate
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.schemas.user import User
    from letta.server.server import SyncServer


router = APIRouter(prefix="/users", tags=["users", "admin"])


@router.get("/", tags=["admin"], response_model=List[User], operation_id="list_users")
async def list_users(
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all users in the database
    """
    try:
        users = await server.user_manager.list_actors_async(after=after, limit=limit)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return users


@router.post("/", tags=["admin"], response_model=User, operation_id="create_user")
async def create_user(
    request: UserCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new user in the database
    """
    user = User(**request.model_dump())
    user = await server.user_manager.create_actor_async(user)
    return user


@router.put("/", tags=["admin"], response_model=User, operation_id="update_user")
async def update_user(
    user: UserUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Update a user in the database
    """
    user = await server.user_manager.update_actor_async(user)
    return user


@router.delete("/", tags=["admin"], response_model=User, operation_id="delete_user")
async def delete_user(
    user_id: str = Query(..., description="The user_id key to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
):
    # TODO make a soft deletion, instead of a hard deletion
    try:
        user = await server.user_manager.get_actor_by_id_async(actor_id=user_id)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User does not exist")
        await server.user_manager.delete_actor_by_id_async(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return user
