#!/usr/bin/env python3
"""
Simple MCP test server with basic and complex tools for testing purposes.
"""

import json
import logging
from typing import List, Optional, Union

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field

# Configure logging to stderr (not stdout for STDIO servers)
logging.basicConfig(level=logging.INFO)

# Initialize FastMCP server
mcp = FastMCP("test-server")


# Complex Pydantic models for testing
class Address(BaseModel):
    """An address with street, city, and zip code."""

    street: str = Field(..., description="Street address")
    city: str = Field(..., description="City name")
    zip_code: str = Field(..., description="ZIP code")
    country: str = Field(default="USA", description="Country name")


class Person(BaseModel):
    """A person with name, age, and optional address."""

    name: str = Field(..., description="Person's full name")
    age: int = Field(..., description="Person's age", ge=0, le=150)
    email: Optional[str] = Field(None, description="Email address")
    address: Optional[Address] = Field(None, description="Home address")


class TaskItem(BaseModel):
    """A task item with title, priority, and completion status."""

    title: str = Field(..., description="Task title")
    priority: int = Field(default=1, description="Priority level (1-5)", ge=1, le=5)
    completed: bool = Field(default=False, description="Whether the task is completed")
    tags: List[str] = Field(default_factory=list, description="List of tags")


class SearchFilter(BaseModel):
    """Filter criteria for searching."""

    keywords: List[str] = Field(..., description="List of keywords to search for")
    min_score: Optional[float] = Field(None, description="Minimum score threshold", ge=0.0, le=1.0)
    categories: Optional[List[str]] = Field(None, description="Categories to filter by")


# Customer-reported schema models (matching mcp_schema.json pattern)
class Instantiation(BaseModel):
    """Instantiation object with optional node identifiers."""

    # model_config = ConfigDict(json_schema_extra={"additionalProperties": False})

    doid: Optional[str] = Field(None, description="DOID identifier")
    nodeFamilyId: Optional[int] = Field(None, description="Node family ID")
    nodeTypeId: Optional[int] = Field(None, description="Node type ID")
    nodePositionId: Optional[int] = Field(None, description="Node position ID")


class InstantiationData(BaseModel):
    """Instantiation data with abstract and multiplicity flags."""

    # model_config = ConfigDict(json_schema_extra={"additionalProperties": False})

    isAbstract: Optional[bool] = Field(None, description="Whether the instantiation is abstract")
    isMultiplicity: Optional[bool] = Field(None, description="Whether the instantiation has multiplicity")
    instantiations: List[Instantiation] = Field(None, description="List of instantiations")


class ParameterPreset(BaseModel):
    """Parameter preset enum values."""

    value: str = Field(..., description="Preset value (a, b, c, e, f, g, h, i, d, l, s, m, z, o, u, unknown)")


@mcp.tool()
async def echo(message: str) -> str:
    """Echo back the provided message.

    Args:
        message: The message to echo back
    """
    return f"Echo: {message}"


@mcp.tool()
async def add(a: float, b: float) -> str:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    result = a + b
    return f"{a} + {b} = {result}"


@mcp.tool()
async def multiply(a: float, b: float) -> str:
    """Multiply two numbers together.

    Args:
        a: First number
        b: Second number
    """
    result = a * b
    return f"{a} × {b} = {result}"


@mcp.tool()
async def reverse_string(text: str) -> str:
    """Reverse a string.

    Args:
        text: The string to reverse
    """
    return text[::-1]


# Complex tools using Pydantic models


@mcp.tool()
async def create_person(person: Person) -> str:
    """Create a person profile with nested address information.

    Args:
        person: Person object with name, age, optional email and address
    """
    result = "Created person profile:\n"
    result += f"  Name: {person.name}\n"
    result += f"  Age: {person.age}\n"

    if person.email:
        result += f"  Email: {person.email}\n"

    if person.address:
        result += "  Address:\n"
        result += f"    {person.address.street}\n"
        result += f"    {person.address.city}, {person.address.zip_code}\n"
        result += f"    {person.address.country}\n"

    return result


@mcp.tool()
async def manage_tasks(tasks: List[TaskItem]) -> str:
    """Manage multiple tasks with priorities and tags.

    Args:
        tasks: List of task items to manage
    """
    if not tasks:
        return "No tasks provided"

    result = f"Managing {len(tasks)} task(s):\n\n"

    for i, task in enumerate(tasks, 1):
        status = "✓" if task.completed else "○"
        result += f"{i}. [{status}] {task.title}\n"
        result += f"   Priority: {task.priority}/5\n"

        if task.tags:
            result += f"   Tags: {', '.join(task.tags)}\n"

        result += "\n"

    completed = sum(1 for t in tasks if t.completed)
    result += f"Summary: {completed}/{len(tasks)} completed"

    return result


@mcp.tool()
async def search_with_filters(query: str, filters: SearchFilter) -> str:
    """Search with complex filter criteria including keywords and categories.

    Args:
        query: The main search query
        filters: Complex filter object with keywords, score threshold, and categories
    """
    result = f"Search Query: '{query}'\n\n"
    result += "Filters Applied:\n"
    result += f"  Keywords: {', '.join(filters.keywords)}\n"

    if filters.min_score is not None:
        result += f"  Minimum Score: {filters.min_score}\n"

    if filters.categories:
        result += f"  Categories: {', '.join(filters.categories)}\n"

    # Simulate search results
    result += "\nFound 3 results matching criteria:\n"
    result += f"  1. Result matching '{filters.keywords[0]}' (score: 0.95)\n"
    result += f"  2. Result matching '{query}' (score: 0.87)\n"
    result += "  3. Result matching multiple keywords (score: 0.82)\n"

    return result


@mcp.tool()
async def process_nested_data(data: dict) -> str:
    """Process arbitrary nested dictionary data.

    Args:
        data: Nested dictionary with arbitrary structure
    """
    result = "Processing nested data:\n"
    result += json.dumps(data, indent=2)
    result += "\n\nData structure stats:\n"
    result += f"  Keys at root level: {len(data)}\n"

    def count_nested_items(obj, depth=0):
        count = 0
        max_depth = depth
        if isinstance(obj, dict):
            for v in obj.values():
                sub_count, sub_depth = count_nested_items(v, depth + 1)
                count += sub_count + 1
                max_depth = max(max_depth, sub_depth)
        elif isinstance(obj, list):
            for item in obj:
                sub_count, sub_depth = count_nested_items(item, depth + 1)
                count += sub_count + 1
                max_depth = max(max_depth, sub_depth)
        return count, max_depth

    total_items, max_depth = count_nested_items(data)
    result += f"  Total nested items: {total_items}\n"
    result += f"  Maximum nesting depth: {max_depth}\n"

    return result


@mcp.tool()
async def get_parameter_type_description(
    preset: str,
    instantiation_data: InstantiationData,
    connected_service_descriptor: Optional[str] = None,
) -> str:
    """Get parameter type description with complex nested structure.

    This tool matches the customer-reported schema pattern with:
    - Enum-like preset parameter
    - Optional string field
    - Optional nested object with arrays of objects

    Args:
        preset: The parameter preset (a, b, c, e, f, g, h, i, d, l, s, m, z, o, u, unknown)
        connected_service_descriptor: Connected service descriptor string, if available
        instantiation_data: Instantiation data dict with isAbstract, isMultiplicity, and instantiations list
    """
    result = "Parameter Type Description\n"
    result += "=" * 50 + "\n\n"
    result += f"Preset: {preset}\n\n"

    if connected_service_descriptor:
        result += f"Connected Service: {connected_service_descriptor}\n\n"

    if instantiation_data:
        result += "Instantiation Data:\n"
        result += f"  Is Abstract: {instantiation_data.isAbstract}\n"
        result += f"  Is Multiplicity: {instantiation_data.isMultiplicity}\n"
        result += f"  Instantiations: {instantiation_data.instantiations}\n"

    return result


def main():
    # Initialize and run the server
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
