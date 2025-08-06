from pydantic import BaseModel, Field


class NpmRequirement(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the npm package.")
    version: str | None = Field(None, description="Optional version of the package, following semantic versioning.")

    def __str__(self) -> str:
        """Return a npm-installable string format."""
        if self.version:
            return f'{self.name}@"{self.version}"'
        return self.name
