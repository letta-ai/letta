"""
Comprehensive pytest suite for testing MCP tool schema override functionality.
Tests both per-tool and per-agent MCP schema overrides with mock client/server interactions.
"""

import pytest
from unittest.mock import MagicMock, patch
from typing import Dict, Any


# Mock Models
class MockTool:
    """Mock Tool object returned by client"""
    def __init__(self, tool_id: str, name: str, json_schema: Dict[str, Any]):
        self.id = tool_id
        self.name = name
        self.json_schema = json_schema


class MockToolsClient:
    """Mock client.tools interface"""
    def __init__(self):
        self._tools = {}
        self._tool_counter = 1
    
    def add_mcp_tool(self, mcp_server_name: str, mcp_tool_name: str) -> MockTool:
        """Add MCP tool with default schema"""
        tool_id = f"tool-{self._tool_counter}"
        self._tool_counter += 1
        
        default_schema = {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Wiki path"}
            },
            "required": ["path"]
        }
        
        tool = MockTool(tool_id, mcp_tool_name, default_schema)
        self._tools[tool_id] = tool
        return tool
    
    def add_mcp_tool_override(
        self, 
        mcp_server_name: str, 
        mcp_tool_name: str, 
        overridden_schema: Dict[str, Any]
    ) -> MockTool:
        """Add or update MCP tool with overridden schema"""
        # Check if tool already exists
        existing_tool = None
        for tool in self._tools.values():
            if tool.name == mcp_tool_name:
                existing_tool = tool
                break
        
        if existing_tool:
            # Update existing tool
            existing_tool.json_schema = overridden_schema
            return existing_tool
        else:
            # Create new tool with overridden schema
            tool_id = f"tool-{self._tool_counter}"
            self._tool_counter += 1
            tool = MockTool(tool_id, mcp_tool_name, overridden_schema)
            self._tools[tool_id] = tool
            return tool
    
    def retrieve(self, tool_id: str) -> MockTool:
        """Retrieve tool by ID"""
        return self._tools.get(tool_id)


class MockAgentToolsClient:
    """Mock client.agents.tools interface"""
    def __init__(self, tools_client: MockToolsClient):
        self._tools_client = tools_client
        self._agent_tools = {}  # agent_id -> list of tool_ids
    
    def attach(self, agent_id: str, tool_id: str):
        """Attach tool to agent"""
        if agent_id not in self._agent_tools:
            self._agent_tools[agent_id] = []
        if tool_id not in self._agent_tools[agent_id]:
            self._agent_tools[agent_id].append(tool_id)
    
    def list(self, agent_id: str):
        """List all tools attached to agent"""
        tool_ids = self._agent_tools.get(agent_id, [])
        return [self._tools_client.retrieve(tid) for tid in tool_ids]
    
    def override_mcp_tool(
        self, 
        agent_id: str, 
        tool_id: str, 
        overridden_schema: Dict[str, Any]
    ):
        """Override MCP tool schema (affects all agents with this tool)"""
        tool = self._tools_client.retrieve(tool_id)
        if tool:
            tool.json_schema = overridden_schema


class MockAgentsClient:
    """Mock client.agents interface"""
    def __init__(self, tools_client: MockToolsClient):
        self.tools = MockAgentToolsClient(tools_client)


class MockClient:
    """Mock Letta client"""
    def __init__(self):
        self.tools = MockToolsClient()
        self.agents = MockAgentsClient(self.tools)


# Fixtures
@pytest.fixture
def client():
    """Provide a mock Letta client"""
    return MockClient()


@pytest.fixture
def default_schema():
    """Original default schema"""
    return {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Wiki path"}
        },
        "required": ["path"]
    }


@pytest.fixture
def new_input_schema():
    """New overridden schema"""
    return {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Wiki path to read"},
            "depth": {"type": "integer", "description": "Depth to traverse"},
            "include_metadata": {"type": "boolean", "description": "Include metadata"}
        },
        "required": ["path", "depth"]
    }


@pytest.fixture
def agent_ids():
    """Provide test agent IDs"""
    return {
        'agent1': 'agent-735f2d68-b0a7-4eed-a3bd-75abc911f571',
        'agent2': 'agent-edfd4884-1c98-459a-abee-7996e0ae743c'
    }


# Tests for Per Tool MCP Schema Override

class TestPerToolMCPSchemaOverride:
    """Test Case 1: Overriding Schema for an Existing MCP Tool in Letta Server"""
    
    def test_add_mcp_tool_with_default_schema(self, client, default_schema):
        """Test adding MCP tool with default schema"""
        tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        assert tool is not None
        assert tool.name == "read_wiki_structure"
        assert tool.json_schema == default_schema
    
    def test_override_existing_mcp_tool_schema(self, client, new_input_schema):
        """Test overriding schema for an existing MCP tool"""
        # Add tool with default schema
        tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        original_schema = tool.json_schema.copy()
        
        # Override schema
        tool_overridden = client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        assert tool_overridden.json_schema == new_input_schema, \
            f"Schema mismatch!\nExpected: {new_input_schema}\nGot: {tool_overridden.json_schema}"
        assert tool_overridden.json_schema != original_schema, \
            f"Schema should have changed from: {original_schema}"
    
    def test_overridden_schema_persistence(self, client, new_input_schema):
        """Test that overridden schema persists after retrieval"""
        # Add and override tool
        tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        tool_overridden = client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Retrieve and validate
        retrieve_updated_mcp_tool = client.tools.retrieve(tool_overridden.id)
        
        assert retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema
        assert retrieve_updated_mcp_tool.json_schema == new_input_schema


class TestAddNewMCPToolWithOverride:
    """Test Case 2: Adding a New MCP Tool with Overridden Schema to Letta Server"""
    
    def test_add_new_mcp_tool_with_override_in_one_shot(self, client, new_input_schema):
        """Test adding new MCP tool with overridden schema in one operation"""
        tool_overridden = client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        assert tool_overridden is not None
        assert tool_overridden.json_schema == new_input_schema
    
    def test_new_tool_override_persistence(self, client, new_input_schema):
        """Test that new tool with override persists correctly"""
        tool_overridden = client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Validate persistence
        retrieve_updated_mcp_tool = client.tools.retrieve(tool_overridden.id)
        
        assert retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema
        assert retrieve_updated_mcp_tool.json_schema == new_input_schema


# Tests for Per Agent MCP Tool Schema Override

class TestPerAgentMCPSchemaOverride:
    """Test per-agent MCP tool schema overrides"""
    
    def test_attach_mcp_tool_to_multiple_agents(self, client, agent_ids):
        """Test attaching same MCP tool to multiple agents"""
        # Add MCP tool
        mcp_tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        # Attach to both agents
        client.agents.tools.attach(
            agent_id=agent_ids['agent1'],
            tool_id=mcp_tool.id
        )
        client.agents.tools.attach(
            agent_id=agent_ids['agent2'],
            tool_id=mcp_tool.id
        )
        
        # Verify both agents have the tool
        agent1_tools = client.agents.tools.list(agent_id=agent_ids['agent1'])
        agent2_tools = client.agents.tools.list(agent_id=agent_ids['agent2'])
        
        assert len(agent1_tools) == 1
        assert len(agent2_tools) == 1
        assert agent1_tools[0].id == mcp_tool.id
        assert agent2_tools[0].id == mcp_tool.id
    
    def test_override_affects_all_agents(self, client, agent_ids, new_input_schema, default_schema):
        """Test that overriding tool schema affects all agents sharing the tool"""
        # Add and attach tool to both agents
        mcp_tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        client.agents.tools.attach(
            agent_id=agent_ids['agent1'],
            tool_id=mcp_tool.id
        )
        client.agents.tools.attach(
            agent_id=agent_ids['agent2'],
            tool_id=mcp_tool.id
        )
        
        # Verify original schema
        assert mcp_tool.json_schema == default_schema
        
        # Override via agent1
        client.agents.tools.override_mcp_tool(
            agent_id=agent_ids['agent1'],
            tool_id=mcp_tool.id,
            overridden_schema=new_input_schema
        )
        
        # Get tools from both agents
        agent1_tools = client.agents.tools.list(agent_id=agent_ids['agent1'])
        agent2_tools = client.agents.tools.list(agent_id=agent_ids['agent2'])
        
        # Find the specific tool
        inspect_tool1 = None
        for t in agent1_tools:
            if t.id == mcp_tool.id:
                inspect_tool1 = t
                break
        
        inspect_tool2 = None
        for t in agent2_tools:
            if t.id == mcp_tool.id:
                inspect_tool2 = t
                break
        
        # Verify both agents see the overridden schema
        assert inspect_tool1 is not None
        assert inspect_tool2 is not None
        assert inspect_tool1.json_schema == new_input_schema
        assert inspect_tool2.json_schema == new_input_schema
        assert inspect_tool1.json_schema == inspect_tool2.json_schema
    
    def test_schema_override_updates_core_db(self, client, agent_ids, new_input_schema):
        """Test that schema override updates core backend DB"""
        # Add and attach tool
        mcp_tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        client.agents.tools.attach(
            agent_id=agent_ids['agent1'],
            tool_id=mcp_tool.id
        )
        
        # Override schema
        client.agents.tools.override_mcp_tool(
            agent_id=agent_ids['agent1'],
            tool_id=mcp_tool.id,
            overridden_schema=new_input_schema
        )
        
        # Retrieve tool directly from tools client (simulating DB retrieval)
        db_tool = client.tools.retrieve(mcp_tool.id)
        
        assert db_tool.json_schema == new_input_schema


# Integration Tests

class TestMCPSchemaOverrideIntegration:
    """Integration tests combining multiple scenarios"""
    
    def test_complete_workflow(self, client, agent_ids, new_input_schema, default_schema):
        """Test complete workflow: add tool, attach to agents, override, verify"""
        # Step 1: Add tool with default schema
        tool = client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        assert tool.json_schema == default_schema
        
        # Step 2: Attach to multiple agents
        client.agents.tools.attach(agent_id=agent_ids['agent1'], tool_id=tool.id)
        client.agents.tools.attach(agent_id=agent_ids['agent2'], tool_id=tool.id)
        
        # Step 3: Override schema via one agent
        client.agents.tools.override_mcp_tool(
            agent_id=agent_ids['agent1'],
            tool_id=tool.id,
            overridden_schema=new_input_schema
        )
        
        # Step 4: Verify all references updated
        retrieved_tool = client.tools.retrieve(tool.id)
        agent1_tools = [t for t in client.agents.tools.list(agent_id=agent_ids['agent1']) if t.id == tool.id]
        agent2_tools = [t for t in client.agents.tools.list(agent_id=agent_ids['agent2']) if t.id == tool.id]
        
        assert retrieved_tool.json_schema == new_input_schema
        assert agent1_tools[0].json_schema == new_input_schema
        assert agent2_tools[0].json_schema == new_input_schema
    
    def test_multiple_tools_different_overrides(self, client, agent_ids, new_input_schema):
        """Test multiple tools with different override scenarios"""
        # Tool 1: Override after creation
        tool1 = client.tools.add_mcp_tool(
            mcp_server_name="server1",
            mcp_tool_name="tool1",
        )
        
        override1 = {"type": "object", "properties": {"field1": {"type": "string"}}}
        client.tools.add_mcp_tool_override(
            mcp_server_name="server1",
            mcp_tool_name="tool1",
            overridden_schema=override1
        )
        
        # Tool 2: Create with override
        override2 = {"type": "object", "properties": {"field2": {"type": "integer"}}}
        tool2 = client.tools.add_mcp_tool_override(
            mcp_server_name="server2",
            mcp_tool_name="tool2",
            overridden_schema=override2
        )
        
        # Verify both have correct schemas
        assert client.tools.retrieve(tool1.id).json_schema == override1
        assert client.tools.retrieve(tool2.id).json_schema == override2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])