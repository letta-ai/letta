from typing import Dict, Optional

from marshmallow import post_dump, pre_load
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from letta.schemas.user import User


class BaseSchema(SQLAlchemyAutoSchema):
    """
    Base schema for all SQLAlchemy models.
    This ensures all schemas share the same session.
    """

    __pydantic_model__ = None

    def __init__(self, *args, actor: Optional[User] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.actor = actor

    @classmethod
    def generate_id(cls) -> Optional[str]:
        if cls.__pydantic_model__:
            return cls.__pydantic_model__.generate_id()

        return None

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs) -> Dict:
        # delete id
        del data["id"]
        del data["_created_by_id"]
        del data["_last_updated_by_id"]
        del data["organization"]

        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            data["id"] = self.generate_id()
            data["_created_by_id"] = self.actor.id
            data["_last_updated_by_id"] = self.actor.id
            data["organization"] = self.actor.organization_id

        return data

    class Meta:
        model = None
        include_relationships = True
        load_instance = True
        exclude = ()
