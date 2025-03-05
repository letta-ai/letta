from typing import Dict, Optional

from marshmallow import post_dump, pre_load
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from sqlalchemy.inspection import inspect

from letta.schemas.user import User


class BaseSchema(SQLAlchemyAutoSchema):
    """
    Base schema for all SQLAlchemy models.
    This ensures all schemas share the same session.
    """

    __pydantic_model__ = None
    sensitive_ids = {"_created_by_id", "_last_updated_by_id"}
    sensitive_relationships = {"organization"}
    id_scramble_placeholder = "xxx"

    def __init__(self, *args, actor: Optional[User] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.actor = actor

    def generate_id(self) -> Optional[str]:
        if self.__pydantic_model__:
            return self.__pydantic_model__.generate_id()

        return None

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            mapper = inspect(self.Meta.model)
            if "id" in mapper.columns:
                generated_id = self.generate_id()
                if generated_id:
                    data["id"] = generated_id

        for sensitive_id in BaseSchema.sensitive_ids.union(BaseSchema.sensitive_relationships):
            if sensitive_id in data:
                data[sensitive_id] = BaseSchema.id_scramble_placeholder

        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            mapper = inspect(self.Meta.model)
            for sensitive_id in BaseSchema.sensitive_ids:
                if sensitive_id in mapper.columns:
                    data[sensitive_id] = self.actor.id

            for relationship in BaseSchema.sensitive_relationships:
                if relationship in mapper.relationships:
                    data[relationship] = self.actor.organization_id

        return data

    class Meta:
        model = None
        include_relationships = True
        load_instance = True
        exclude = ()
