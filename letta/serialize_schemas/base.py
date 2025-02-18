from marshmallow_sqlalchemy import SQLAlchemyAutoSchema


class BaseSchema(SQLAlchemyAutoSchema):
    """
    Base schema for all SQLAlchemy models.
    This ensures all schemas share the same session.
    """

    class Meta:
        include_relationships = True
        load_instance = True
