from typing import Optional

from pydantic import BaseModel, Field


class PipRequirement(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the pip package.")
    version: Optional[str] = Field(None, description="Optional version of the package, following semantic versioning.")

    def __str__(self) -> str:
        """Return a pip-installable string format."""
        if self.version:
            return f"{self.name}=={self.version}"
        return self.name
