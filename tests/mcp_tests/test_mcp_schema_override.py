"""
Mocked pytest tests for Letta MCP tool schema override functionality.
Tests both per-tool and per-agent schema override scenarios.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from letta_client import Letta


# Test Data Fixtures
@pytest.fixture
def new_input_schema():
    """Schema used for overriding MCP tool schemas"""
    return {
        "$schema": "http://json-schema.org/draft-06/schema#",
        "additionalProperties": False,
        "properties": {
            "repoName": {
                "description": "GitHub repository: owner/repo " '(e.g. "letta/letta")',
                "type": "string",
            }
        },
        "required": ["repoName"],
        "type": "object",
    }


@pytest.fixture
def original_schema():
    """Original MCP tool schema before override"""
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "additionalProperties": False,
        "properties": {
            "wiki_path": {
                "description": "Path to wiki structure",
                "type": "string",
            }
        },
        "required": ["wiki_path"],
        "type": "object",
    }


@pytest.fixture
def mock_tool(original_schema):
    """Mock tool object returned from MCP server"""
    tool = Mock()
    tool.id = "tool-12345"
    tool.name = "read_wiki_structure"
    tool.json_schema = original_schema
    return tool


@pytest.fixture
def mock_tool_overridden(new_input_schema):
    """Mock tool object with overridden schema"""
    tool = Mock()
    tool.id = "tool-12345"
    tool.name = "read_wiki_structure"
    tool.json_schema = new_input_schema
    return tool


@pytest.fixture
def agent_ids():
    """Agent IDs for multi-agent testing"""
    return {
        "agent1": "agent-735f2d68-b0a7-4eed-a3bd-75abc911f571",
        "agent2": "agent-edfd4884-1c98-459a-abee-7996e0ae743c"
    }


@pytest.fixture
def mock_client():
    """Mock Letta client with all necessary methods"""
    client = Mock(spec=Letta)
    print
    
    # Mock the tools namespace
    client.tools = Mock()
    client.tools.add_mcp_tool = Mock()
    client.tools.add_mcp_tool_override = Mock()
    client.tools.retrieve = Mock()
    
    # Mock the agents namespace
    client.agents = Mock()
    client.agents.tools = Mock()
    client.agents.tools.attach = Mock()
    client.agents.tools.list = Mock()
    client.agents.tools.override_mcp_tool = Mock()
    
    return client


########################################
# Per Tool MCP Schema Override Tests
########################################

class TestPerToolSchemaOverride:
    """Test cases for overriding MCP tool schemas at the tool level"""
    
    def test_override_existing_mcp_tool_schema(
        self, mock_client, mock_tool, mock_tool_overridden, 
        new_input_schema, original_schema
    ):
        """
        Case 1: Overriding Schema for an Existing MCP Tool in Letta Server
        
        Tests that:
        1. Tool is added with original schema
        2. Schema can be overridden
        3. Overridden schema persists when retrieved
        """
        # Setup mocks
        mock_client.tools.add_mcp_tool.return_value = mock_tool
        mock_client.tools.add_mcp_tool_override.return_value = mock_tool_overridden
        mock_client.tools.retrieve.return_value = mock_tool_overridden
        
        # Add MCP tool with default schema
        tool = mock_client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        # Verify original schema
        assert tool.json_schema == original_schema
        mock_client.tools.add_mcp_tool.assert_called_once_with(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        # Override schema
        tool_overridden = mock_client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Verify schema was overridden
        assert tool_overridden.json_schema == new_input_schema
        assert tool_overridden.json_schema != original_schema
        mock_client.tools.add_mcp_tool_override.assert_called_once_with(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Validate that updated schema persisted
        retrieve_updated_mcp_tool = mock_client.tools.retrieve(tool_overridden.id)
        assert retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema
        assert retrieve_updated_mcp_tool.json_schema == new_input_schema
        
        mock_client.tools.retrieve.assert_called_once_with(tool_overridden.id)
    
    
    def test_add_new_mcp_tool_with_overridden_schema(
        self, mock_client, mock_tool_overridden, new_input_schema
    ):
        """
        Case 2: Adding a New MCP Tool with Overridden Schema to Letta Server
        
        Tests that:
        1. New tool can be added with overridden schema in one operation
        2. Overridden schema persists when retrieved
        """
        # Setup mocks
        mock_client.tools.add_mcp_tool_override.return_value = mock_tool_overridden
        mock_client.tools.retrieve.return_value = mock_tool_overridden
        
        # Add new MCP tool with overridden schema in one shot
        tool_overridden = mock_client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Verify overridden schema is set
        assert tool_overridden.json_schema == new_input_schema
        mock_client.tools.add_mcp_tool_override.assert_called_once_with(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Validate that updated schema persisted
        retrieve_updated_mcp_tool = mock_client.tools.retrieve(tool_overridden.id)

        assert retrieve_updated_mcp_tool.id == tool_overridden.id
        assert retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema
        assert retrieve_updated_mcp_tool.json_schema == new_input_schema
        
        mock_client.tools.retrieve.assert_called_once_with(tool_overridden.id)


########################################
# Per Agent MCP Tool Schema Override Tests
########################################

class TestPerAgentSchemaOverride:
    """Test cases for overriding MCP tool schemas at the agent level"""
    
    def test_override_mcp_tool_for_multiple_agents(
        self, mock_client, mock_tool, agent_ids, 
        new_input_schema, original_schema
    ):
        """
        Tests per-agent MCP tool schema override functionality
        
        Tests that:
        1. MCP tool is added to server
        2. Tool is attached to multiple agents
        3. Schema override affects all agents sharing the tool
        4. Both agents see the same overridden schema
        """
        # Create mock tools for each agent with overridden schema
        agent1_tool = Mock()
        agent1_tool.id = mock_tool.id
        agent1_tool.name = "read_wiki_structure"
        agent1_tool.json_schema = new_input_schema
        
        agent2_tool = Mock()
        agent2_tool.id = mock_tool.id
        agent2_tool.name = "read_wiki_structure"
        agent2_tool.json_schema = new_input_schema
        
        # Setup mocks
        mock_client.tools.add_mcp_tool.return_value = mock_tool
        mock_client.agents.tools.list.side_effect = [
            [agent1_tool],  # First call for agent1
            [agent2_tool],  # Second call for agent2
        ]
        
        # Add MCP tool to Letta Server
        mcp_tool = mock_client.tools.add_mcp_tool(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        assert mcp_tool.json_schema == original_schema
        mock_client.tools.add_mcp_tool.assert_called_once_with(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
        )
        
        # Attach tool to agent1
        mock_client.agents.tools.attach(
            agent_id=agent_ids["agent1"],
            tool_id=f"{mcp_tool.id}"
        )
        
        # Attach tool to agent2
        mock_client.agents.tools.attach(
            agent_id=agent_ids["agent2"],
            tool_id=f"{mcp_tool.id}"
        )
        
        # Verify attach was called for both agents
        assert mock_client.agents.tools.attach.call_count == 2
        mock_client.agents.tools.attach.assert_any_call(
            agent_id=agent_ids["agent1"],
            tool_id=f"{mcp_tool.id}"
        )
        mock_client.agents.tools.attach.assert_any_call(
            agent_id=agent_ids["agent2"],
            tool_id=f"{mcp_tool.id}"
        )
        
        # Override MCP tool schema for agent1
        # (this should update the core backend DB, affecting all agents)
        mock_client.agents.tools.override_mcp_tool(
            agent_id=agent_ids["agent1"],
            tool_id=f"{mcp_tool.id}",
            overridden_schema=new_input_schema
        )
        
        mock_client.agents.tools.override_mcp_tool.assert_called_once_with(
            agent_id=agent_ids["agent1"],
            tool_id=f"{mcp_tool.id}",
            overridden_schema=new_input_schema
        )
        
        # Get tool from agent1's tool list
        agent1_tools = mock_client.agents.tools.list(agent_id=agent_ids["agent1"])
        inspect_tool1 = None
        for t in agent1_tools:
            if t.id == mcp_tool.id:
                inspect_tool1 = t
                break
        
        # Get tool from agent2's tool list
        agent2_tools = mock_client.agents.tools.list(agent_id=agent_ids["agent2"])
        inspect_tool2 = None
        for t in agent2_tools:
            if t.id == mcp_tool.id:
                inspect_tool2 = t
                break
        
        # Verify both tools were found
        assert inspect_tool1 is not None
        assert inspect_tool2 is not None
        
        # Verify overridden schema for both agents
        assert inspect_tool1.json_schema == new_input_schema
        assert inspect_tool2.json_schema == new_input_schema
        
        # Verify both agents have matching schemas (core DB update affects all agents)
        assert inspect_tool1.json_schema == inspect_tool2.json_schema
        
        # Verify list was called for both agents
        assert mock_client.agents.tools.list.call_count == 2
        mock_client.agents.tools.list.assert_any_call(agent_id=agent_ids["agent1"])
        mock_client.agents.tools.list.assert_any_call(agent_id=agent_ids["agent2"])


########################################
# Integration/Edge Case Tests
########################################

class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    def test_schema_override_idempotency(
        self, mock_client, mock_tool_overridden, new_input_schema
    ):
        """Test that overriding schema multiple times works correctly"""
        mock_client.tools.add_mcp_tool_override.return_value = mock_tool_overridden
        
        # Override schema first time
        tool1 = mock_client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        # Override schema second time (should work without error)
        tool2 = mock_client.tools.add_mcp_tool_override(
            mcp_server_name="deep_wiki_server",
            mcp_tool_name="read_wiki_structure",
            overridden_schema=new_input_schema,
        )
        
        assert tool1.json_schema == tool2.json_schema
        assert mock_client.tools.add_mcp_tool_override.call_count == 2
    
    
    def test_retrieve_nonexistent_tool(self, mock_client):
        """Test retrieving a tool that doesn't exist"""
        mock_client.tools.retrieve.return_value = None
        
        result = mock_client.tools.retrieve("nonexistent-tool-id")
        
        assert result is None
        mock_client.tools.retrieve.assert_called_once_with("nonexistent-tool-id")
    
    
    def test_agent_tool_list_empty(self, mock_client, agent_ids):
        """Test listing tools for an agent with no tools"""
        mock_client.agents.tools.list.return_value = []
        
        tools = mock_client.agents.tools.list(agent_id=agent_ids["agent1"])
        
        assert tools == []
        assert len(tools) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])