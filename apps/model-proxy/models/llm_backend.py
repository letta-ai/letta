from typing import List, Union, Optional, Dict, Literal
from pydantic import BaseModel, Field, Json


class LLMBackendConfig(BaseModel):
    model: str
    context_window: int
    model_wrapper: Optional[str]
    model_endpoint: str
    model_endpoint_type: str
