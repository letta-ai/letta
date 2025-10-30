#!/usr/bin/env python3
"""
Mock MCP server for testing.
Implements a simple stdio-based MCP server with various test tools using FastMCP.
"""

import argparse
import json
import logging
import sys
from typing import Any, Dict, List, Optional

try:
    from mcp.server.fastmcp import FastMCP
    from pydantic import BaseModel, Field
except ImportError as e:
    print(f"Error importing required modules: {e}", file=sys.stderr)
    print("Please ensure mcp and pydantic are installed", file=sys.stderr)
    sys.exit(1)

# Parse command line arguments
parser = argparse.ArgumentParser(description="Mock MCP server for testing")
parser.add_argument("--no-tools", action="store_true", help="Start server with no tools")
args = parser.parse_args()

# Configure logging to stderr (not stdout for STDIO servers)
logging.basicConfig(level=logging.INFO)

# Initialize FastMCP server
mcp = FastMCP("mock-mcp-server")


# Pydantic models for complex tools
class Address(BaseModel):
    """An address with street, city, and zip code."""

    street: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, description="City name")
    zip: Optional[str] = Field(None, description="ZIP code")


class Instantiation(BaseModel):
    """Instantiation object with optional node identifiers."""

    doid: Optional[str] = Field(None, description="DOID identifier")
    nodeFamilyId: Optional[int] = Field(None, description="Node family ID")


class InstantiationData(BaseModel):
    """Instantiation data with abstract and multiplicity flags."""

    isAbstract: Optional[bool] = Field(None, description="Whether the instantiation is abstract")
    isMultiplicity: Optional[bool] = Field(None, description="Whether the instantiation has multiplicity")
    instantiations: Optional[List[Instantiation]] = Field(None, description="List of instantiations")


# Only register tools if --no-tools flag is not set
if not args.no_tools:
    # Simple tools
    @mcp.tool()
    async def echo(message: str) -> str:
        """Echo back a message.

        Args:
            message: The message to echo
        """
        return f"Echo: {message}"

    @mcp.tool()
    async def add(a: float, b: float) -> str:
        """Add two numbers.

        Args:
            a: First number
            b: Second number
        """
        return f"Result: {a + b}"

    @mcp.tool()
    async def multiply(a: float, b: float) -> str:
        """Multiply two numbers.

        Args:
            a: First number
            b: Second number
        """
        return f"Result: {a * b}"

    @mcp.tool()
    async def reverse_string(text: str) -> str:
        """Reverse a string.

        Args:
            text: The text to reverse
        """
        return f"Reversed: {text[::-1]}"

    # Complex tools
    @mcp.tool()
    async def create_person(name: str, age: Optional[int] = None, email: Optional[str] = None, address: Optional[Address] = None) -> str:
        """Create a person object with details.

        Args:
            name: Person's name
            age: Person's age
            email: Person's email
            address: Person's address
        """
        person_data = {"name": name}
        if age is not None:
            person_data["age"] = age
        if email is not None:
            person_data["email"] = email
        if address is not None:
            person_data["address"] = address.model_dump(exclude_none=True)

        return f"Created person: {json.dumps(person_data)}"

    @mcp.tool()
    async def manage_tasks(action: str, task: Optional[str] = None) -> str:
        """Manage a list of tasks.

        Args:
            action: The action to perform (add, remove, list)
            task: The task to add or remove
        """
        if action == "add":
            return f"Added task: {task}"
        elif action == "remove":
            return f"Removed task: {task}"
        else:
            return "Listed tasks: []"

    @mcp.tool()
    async def search_with_filters(query: str, filters: Optional[Dict[str, Any]] = None) -> str:
        """Search with various filters.

        Args:
            query: Search query
            filters: Optional filters dictionary
        """
        return f"Search results for '{query}' with filters {filters}"

    @mcp.tool()
    async def process_nested_data(data: Dict[str, Any]) -> str:
        """Process deeply nested data structures.

        Args:
            data: The nested data to process
        """
        return f"Processed nested data: {json.dumps(data)}"

    @mcp.tool()
    async def get_parameter_type_description(
        preset: str, connected_service_descriptor: Optional[str] = None, instantiation_data: Optional[InstantiationData] = None
    ) -> str:
        """Get parameter type description with complex schema.

        Args:
            preset: Preset configuration (a, b, c)
            connected_service_descriptor: Service descriptor
            instantiation_data: Instantiation data with nested structure
        """
        result = f"Preset: {preset}"
        if connected_service_descriptor:
            result += f", Service: {connected_service_descriptor}"
        if instantiation_data:
            result += f", Instantiation data: {json.dumps(instantiation_data.model_dump(exclude_none=True))}"
        return result


def main():
    """Run the MCP server using stdio transport."""
    try:
        mcp.run(transport="stdio")
    except KeyboardInterrupt:
        # Clean exit on Ctrl+C
        sys.exit(0)
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
