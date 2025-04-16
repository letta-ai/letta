from pydantic import BaseModel


# Define a model class to structure the response data
class Model(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str
