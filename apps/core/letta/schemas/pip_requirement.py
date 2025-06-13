import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PipRequirement(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the pip package.")
    version: Optional[str] = Field(None, description="Optional version of the package, following semantic versioning.")

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        semver_pattern = re.compile(r"^\d+(\.\d+){0,2}(-[a-zA-Z0-9.]+)?$")
        if not semver_pattern.match(v):
            raise ValueError(f"Invalid version format: {v}. Must follow semantic versioning (e.g., 1.2.3, 2.0, 1.5.0-alpha).")
        return v

    def __str__(self) -> str:
        """Return a pip-installable string format."""
        if self.version:
            return f"{self.name}=={self.version}"
        return self.name
