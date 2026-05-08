from unittest.mock import AsyncMock, MagicMock

import pytest

from letta.services.context_window_calculator.context_window_calculator import ContextWindowCalculator


class TestExtractTagContent:
    """Tests for the _extract_tag_content helper method"""

    def test_extracts_simple_tag(self):
        text = "prefix <tag>content</tag> suffix"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result == "<tag>content</tag>"

    def test_returns_none_for_missing_tag(self):
        text = "no tags here"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result is None

    def test_returns_none_for_missing_opening_tag(self):
        text = "content</tag>"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result is None

    def test_returns_none_for_unclosed_tag(self):
        text = "<tag>content without closing"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result is None

    def test_handles_multiline_content(self):
        text = "<tag>\nline1\nline2\n</tag>"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result == "<tag>\nline1\nline2\n</tag>"

    def test_handles_nested_content(self):
        text = "<outer><inner>nested</inner></outer>"
        result = ContextWindowCalculator._extract_tag_content(text, "outer")
        assert result == "<outer><inner>nested</inner></outer>"

    def test_handles_empty_content(self):
        text = "<tag></tag>"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result == "<tag></tag>"

    def test_extracts_first_occurrence_with_duplicate_tags(self):
        """When duplicate tags exist, only the first occurrence is extracted"""
        text = "<tag>first</tag> some text <tag>second</tag>"
        result = ContextWindowCalculator._extract_tag_content(text, "tag")
        assert result == "<tag>first</tag>"


class TestExtractSystemComponents:
    """Tests for the extract_system_components method"""

    def test_extracts_standard_agent_sections(self):
        """Standard agent with base_instructions, memory_blocks, and memory_metadata"""
        system_message = """
<base_instructions>
Base prompt here
</base_instructions>

<memory_blocks>
Core memory content
</memory_blocks>

<memory_metadata>
Metadata here
</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["system_prompt"] is not None
        assert "<base_instructions>" in result["system_prompt"]
        assert "Base prompt here" in result["system_prompt"]

        assert result["core_memory"] is not None
        assert "Core memory content" in result["core_memory"]

        assert result["external_memory_summary"] is not None
        assert "<memory_metadata>" in result["external_memory_summary"]

        # These should be None for standard agent
        assert result["memory_filesystem"] is None
        assert result["tool_usage_rules"] is None
        assert result["directories"] is None

    def test_extracts_git_enabled_agent_sections(self):
        """Git-enabled agent has top-level memory_filesystem OUTSIDE memory_blocks"""
        system_message = (
            "<base_instructions>Base</base_instructions>\n"
            "<memory_filesystem>\n"
            "memory/\n"
            "  system/\n"
            "    human.md (100 chars)\n"
            "</memory_filesystem>\n"
            "<memory_metadata>Meta</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["core_memory"] is None  # git-enabled agents don't use <memory_blocks>
        assert result["memory_filesystem"] is not None
        assert "memory/" in result["memory_filesystem"]
        assert "human.md" in result["memory_filesystem"]

    def test_extracts_tool_usage_rules(self):
        """Agent with tool usage rules configured"""
        system_message = """
<base_instructions>Base</base_instructions>
<memory_blocks>Memory</memory_blocks>
<tool_usage_rules>
You must use tools in a specific order.
</tool_usage_rules>
<memory_metadata>Meta</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["tool_usage_rules"] is not None
        assert "specific order" in result["tool_usage_rules"]

    def test_extracts_directories(self):
        """Agent with attached sources has directories section"""
        system_message = """
<base_instructions>Base</base_instructions>
<memory_blocks>Memory</memory_blocks>
<directories>
<directory name="project">
<file status="open" name="readme.md">
README content
</file>
</directory>
</directories>
<memory_metadata>Meta</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["directories"] is not None
        assert '<directory name="project">' in result["directories"]
        assert "readme.md" in result["directories"]

    def test_handles_react_agent_no_memory_blocks(self):
        """React/workflow agents don't render <memory_blocks>"""
        system_message = """
<base_instructions>React agent base</base_instructions>
<directories>
Some directory content
</directories>
<memory_metadata>Meta</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["system_prompt"] is not None
        assert result["core_memory"] is None  # No memory_blocks for react agents
        assert result["directories"] is not None
        assert result["external_memory_summary"] is not None

    def test_handles_all_sections_present(self):
        """Full agent with all optional sections"""
        system_message = """
<base_instructions>Base instructions</base_instructions>
<memory_blocks>Memory blocks content</memory_blocks>
<memory_filesystem>Filesystem tree</memory_filesystem>
<tool_usage_rules>Tool rules</tool_usage_rules>
<directories>Directories content</directories>
<memory_metadata>Metadata</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["system_prompt"] is not None
        assert result["core_memory"] is not None
        assert result["memory_filesystem"] is not None
        assert result["tool_usage_rules"] is not None
        assert result["directories"] is not None
        assert result["external_memory_summary"] is not None

    def test_handles_empty_string(self):
        """Empty input returns all None values"""
        result = ContextWindowCalculator.extract_system_components("")
        assert all(v is None for v in result.values())

    def test_returns_correct_dict_keys(self):
        """Verify the returned dict has all expected keys"""
        result = ContextWindowCalculator.extract_system_components("")
        expected_keys = {
            "system_prompt",
            "core_memory",
            "memory_filesystem",
            "tool_usage_rules",
            "directories",
            "external_memory_summary",
        }
        assert set(result.keys()) == expected_keys

    def test_no_base_instructions_tag_extracts_preamble(self):
        """Custom system prompts without <base_instructions> should extract preamble text"""
        system_message = (
            "You are a helpful AI agent.\n"
            "Use the tools available to you.\n\n"
            "<memory_blocks>\n"
            "<persona>My name is Letta.</persona>\n"
            "</memory_blocks>\n\n"
            "<memory_metadata>Metadata here</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["system_prompt"] is not None
        assert "helpful AI agent" in result["system_prompt"]
        assert "Use the tools" in result["system_prompt"]
        # Should NOT include memory_blocks content
        assert "<memory_blocks>" not in result["system_prompt"]
        assert "<memory_metadata>" not in result["system_prompt"]

        assert result["core_memory"] is not None
        assert result["external_memory_summary"] is not None

    def test_nested_memory_filesystem_not_extracted_as_top_level(self):
        """memory_filesystem block INSIDE memory_blocks should NOT be extracted as top-level"""
        system_message = (
            "You are a self-improving AI agent.\n\n"
            "<memory_blocks>\n"
            "The following memory blocks are currently engaged:\n\n"
            "<memory_filesystem>\n"
            "<value>\n"
            "/memory/\n"
            "\u251c\u2500\u2500 system/\n"
            "\u2502   \u251c\u2500\u2500 human.md\n"
            "\u2502   \u2514\u2500\u2500 persona.md\n"
            "</value>\n"
            "</memory_filesystem>\n\n"
            "<persona>My name is Letta.</persona>\n"
            "</memory_blocks>\n\n"
            "<memory_metadata>Metadata</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        # memory_filesystem is nested inside memory_blocks - should NOT be extracted
        assert result["memory_filesystem"] is None

        # core_memory should include the full memory_blocks content (including the nested filesystem)
        assert result["core_memory"] is not None
        assert "<memory_filesystem>" in result["core_memory"]
        assert "human.md" in result["core_memory"]

    def test_top_level_memory_filesystem_outside_memory_blocks(self):
        """Top-level memory_filesystem (git-enabled) rendered BEFORE memory_blocks is extracted"""
        system_message = (
            "<base_instructions>Base</base_instructions>\n"
            "<memory_filesystem>\n"
            "\u251c\u2500\u2500 system/\n"
            "\u2502   \u2514\u2500\u2500 human.md\n"
            "</memory_filesystem>\n\n"
            "<system/human.md>\n---\ndescription: About the human\n---\nName: Alice\n</system/human.md>\n\n"
            "<memory_metadata>Meta</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        # This memory_filesystem is top-level (no memory_blocks container)
        assert result["memory_filesystem"] is not None
        assert "human.md" in result["memory_filesystem"]

        # Bare file blocks after </memory_filesystem> are captured as core_memory
        assert result["core_memory"] is not None
        assert "<system/human.md>" in result["core_memory"]
        assert "Name: Alice" in result["core_memory"]

    def test_letta_code_agent_real_format(self):
        """Real-world Letta Code agent format: no base_instructions, nested memory_filesystem"""
        system_message = (
            "You are a self-improving AI agent with advanced memory.\n"
            "You are connected to an interactive CLI tool.\n\n"
            "# Memory\n"
            "You have an advanced memory system.\n\n"
            "<memory_blocks>\n"
            "The following memory blocks are currently engaged:\n\n"
            "<memory_filesystem>\n"
            "<description>Filesystem view</description>\n"
            "<value>\n"
            "/memory/\n"
            "\u251c\u2500\u2500 system/\n"
            "\u2502   \u251c\u2500\u2500 human.md\n"
            "\u2502   \u2514\u2500\u2500 persona.md\n"
            "</value>\n"
            "</memory_filesystem>\n\n"
            "<persona>\n"
            "<value>My name is Letta Code.</value>\n"
            "</persona>\n\n"
            "<human>\n"
            "<value>Name: Jin Peng</value>\n"
            "</human>\n"
            "</memory_blocks>\n\n"
            "<memory_metadata>\n"
            "- The current system date is: February 10, 2026\n"
            "- 9663 previous messages in recall memory\n"
            "</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        # System prompt: preamble before <memory_blocks>
        assert result["system_prompt"] is not None
        assert "self-improving AI agent" in result["system_prompt"]
        assert "advanced memory system" in result["system_prompt"]
        assert "<memory_blocks>" not in result["system_prompt"]

        # Core memory: the full <memory_blocks> section
        assert result["core_memory"] is not None
        assert "Letta Code" in result["core_memory"]
        assert "Jin Peng" in result["core_memory"]

        # memory_filesystem is NESTED inside memory_blocks - should NOT be extracted
        assert result["memory_filesystem"] is None

        # No tool_usage_rules or directories
        assert result["tool_usage_rules"] is None
        assert result["directories"] is None

        # External memory summary
        assert result["external_memory_summary"] is not None
        assert "February 10, 2026" in result["external_memory_summary"]

    def test_git_enabled_agent_bare_file_blocks_captured_as_core_memory(self):
        """Git-enabled agents render bare file blocks after </memory_filesystem> — these must be captured as core_memory"""
        system_message = (
            "<base_instructions>Base</base_instructions>\n"
            "<memory_filesystem>\n"
            "\u251c\u2500\u2500 system/\n"
            "\u2502   \u251c\u2500\u2500 human.md\n"
            "\u2502   \u2514\u2500\u2500 persona.md\n"
            "</memory_filesystem>\n\n"
            "<system/human.md>\n---\ndescription: About the human\nlimit: 2000\n---\nName: Alice\n</system/human.md>\n\n"
            "<system/persona.md>\n---\ndescription: Agent persona\n---\nI am a helpful assistant.\n</system/persona.md>\n\n"
            "<tool_usage_rules>Always call send_message to respond.</tool_usage_rules>\n"
            "<memory_metadata>Meta</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)

        # memory_filesystem should preserve tree connectors with deterministic ordering
        assert result["memory_filesystem"] is not None
        assert "\u251c\u2500\u2500 system/" in result["memory_filesystem"]

        # core_memory should capture the bare file blocks
        assert result["core_memory"] is not None
        assert "<system/human.md>" in result["core_memory"]
        assert "Name: Alice" in result["core_memory"]
        assert "<system/persona.md>" in result["core_memory"]
        assert "helpful assistant" in result["core_memory"]

        # tool_usage_rules should NOT be included in core_memory
        assert "<tool_usage_rules>" not in result["core_memory"]

        # Other sections
        assert result["tool_usage_rules"] is not None
        assert result["external_memory_summary"] is not None

    def test_git_enabled_agent_no_bare_blocks(self):
        """Git-enabled agent with no file blocks after memory_filesystem returns None for core_memory"""
        system_message = (
            "<base_instructions>Base</base_instructions>\n"
            "<memory_filesystem>\n"
            "\u251c\u2500\u2500 system/\n"
            "</memory_filesystem>\n"
            "<memory_metadata>Meta</memory_metadata>"
        )
        result = ContextWindowCalculator.extract_system_components(system_message)
        assert result["memory_filesystem"] is not None
        assert result["core_memory"] is None

    def test_extract_top_level_tag_dual_occurrence_nested_first(self):
        """When a tag appears nested first and top-level later, the top-level one is extracted"""
        system_message = (
            "<memory_blocks>\n"
            "<tool_usage_rules>nested rules</tool_usage_rules>\n"
            "</memory_blocks>\n\n"
            "<tool_usage_rules>top-level rules</tool_usage_rules>"
        )
        result = ContextWindowCalculator._extract_top_level_tag(system_message, "tool_usage_rules")
        assert result is not None
        assert "top-level rules" in result
        assert "nested rules" not in result

    def test_extract_system_prompt_pure_text_no_tags(self):
        """System message with no section tags at all returns the full text as system_prompt"""
        system_message = "You are a simple agent.\nYou help the user with tasks."
        result = ContextWindowCalculator._extract_system_prompt(system_message)
        assert result is not None
        assert "simple agent" in result
        assert "help the user" in result

    def test_git_backed_memory_without_memory_blocks_wrapper(self):
        """Regression test from main: git-backed agents without <memory_blocks> wrapper"""
        system_message = """You are some system prompt.

<memory_filesystem>
Memory Directory: ~/.letta/agents/agent-123/memory

/memory/
\u2514\u2500\u2500 system/
    \u2514\u2500\u2500 human.md
</memory_filesystem>

<system/human.md>
---
description: test
limit: 10
---
hello
</system/human.md>

<memory_metadata>
- foo=bar
</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert "You are some system prompt" in result["system_prompt"]
        # memory_filesystem is a top-level section
        assert result["memory_filesystem"] is not None
        assert "<memory_filesystem>" in result["memory_filesystem"]
        # bare file blocks are captured as core_memory
        assert result["core_memory"] is not None
        assert "<system/human.md>" in result["core_memory"]
        assert result["external_memory_summary"].startswith("<memory_metadata>")

    def test_legacy_memory_blocks_wrapper(self):
        """Regression test from main: legacy memory_blocks wrapper is properly parsed"""
        system_message = """<base_instructions>SYS</base_instructions>

<memory_blocks>
<persona>p</persona>
</memory_blocks>

<memory_metadata>
- x=y
</memory_metadata>
"""
        result = ContextWindowCalculator.extract_system_components(system_message)

        assert result["system_prompt"].startswith("<base_instructions>")
        assert result["core_memory"].startswith("<memory_blocks>")
        assert result["external_memory_summary"].startswith("<memory_metadata>")


def _make_system_message(text: str):
    """Helper to create a real Message object for use as a system message in tests."""
    from letta.schemas.enums import MessageRole
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message

    return Message(role=MessageRole.system, content=[TextContent(text=text)])


def _make_mock_deps(system_text: str):
    """Helper to create mocked token_counter, message_manager, and agent_state."""
    token_counter = MagicMock()
    token_counter.count_text_tokens = AsyncMock(side_effect=lambda text: len(text) if text else 0)
    token_counter.count_message_tokens = AsyncMock(return_value=0)
    token_counter.count_tool_tokens = AsyncMock(return_value=0)
    token_counter.convert_messages = MagicMock(return_value=[{"role": "system", "content": system_text}])

    message_manager = MagicMock()
    message_manager.get_messages_by_ids_async = AsyncMock(return_value=[])

    agent_state = MagicMock()
    agent_state.id = "agent-test"
    agent_state.message_ids = ["msg-sys"]
    agent_state.system = "fallback system prompt"
    agent_state.tools = []
    agent_state.llm_config.context_window = 128000

    actor = MagicMock()

    return token_counter, message_manager, agent_state, actor


class TestCalculateContextWindow:
    """Integration tests for calculate_context_window with mocked dependencies"""

    @pytest.mark.asyncio
    async def test_calculate_context_window_standard_agent(self):
        """Test full context window calculation with a standard system message"""
        system_text = (
            "<base_instructions>You are a helpful agent.</base_instructions>\n"
            "<memory_blocks>human: User is Alice</memory_blocks>\n"
            "<memory_metadata>Archival: 5 passages</memory_metadata>"
        )

        system_msg = _make_system_message(system_text)
        token_counter, message_manager, agent_state, actor = _make_mock_deps(system_text)

        calculator = ContextWindowCalculator()
        result = await calculator.calculate_context_window(
            agent_state=agent_state,
            actor=actor,
            token_counter=token_counter,
            message_manager=message_manager,
            system_message_compiled=system_msg,
            num_archival_memories=5,
            num_messages=10,
            message_ids=[],
        )

        assert result.context_window_size_max == 128000
        assert result.num_archival_memory == 5
        assert result.num_recall_memory == 10
        assert result.num_tokens_system > 0
        assert "helpful agent" in result.system_prompt
        assert result.num_tokens_core_memory > 0
        assert "User is Alice" in result.core_memory
        assert result.num_tokens_external_memory_summary > 0

        # New sections should be None/0 since not in system message
        assert result.memory_filesystem is None
        assert result.num_tokens_memory_filesystem == 0
        assert result.tool_usage_rules is None
        assert result.num_tokens_tool_usage_rules == 0
        assert result.directories is None
        assert result.num_tokens_directories == 0

    @pytest.mark.asyncio
    async def test_calculate_context_window_skips_empty_sections(self):
        """Verify that token counting is skipped for empty/missing sections"""
        # Only base_instructions, no other sections
        system_text = "<base_instructions>Simple agent</base_instructions>"

        system_msg = _make_system_message(system_text)
        token_counter, message_manager, agent_state, actor = _make_mock_deps(system_text)

        calculator = ContextWindowCalculator()
        await calculator.calculate_context_window(
            agent_state=agent_state,
            actor=actor,
            token_counter=token_counter,
            message_manager=message_manager,
            system_message_compiled=system_msg,
            num_archival_memories=0,
            num_messages=0,
            message_ids=[],
        )

        # count_text_tokens should only be called for system_prompt (non-empty)
        # and NOT for core_memory, memory_filesystem, tool_usage_rules, directories,
        # external_memory_summary, or summary_memory (all empty/None)
        calls = token_counter.count_text_tokens.call_args_list
        assert len(calls) == 1, f"Expected 1 call to count_text_tokens (system_prompt only), got {len(calls)}: {calls}"

    @pytest.mark.asyncio
    async def test_calculate_context_window_all_sections(self):
        """Test with all optional sections present"""
        system_text = (
            "<base_instructions>Agent instructions</base_instructions>\n"
            "<memory_blocks>Core memory</memory_blocks>\n"
            "<memory_filesystem>\u251c\u2500\u2500 system/\n\u2502   \u2514\u2500\u2500 human.md</memory_filesystem>\n"
            "<tool_usage_rules>Always call search first</tool_usage_rules>\n"
            '<directories><directory name="docs">content</directory></directories>\n'
            "<memory_metadata>Archival: 10 passages</memory_metadata>"
        )

        system_msg = _make_system_message(system_text)
        token_counter, message_manager, agent_state, actor = _make_mock_deps(system_text)

        calculator = ContextWindowCalculator()
        result = await calculator.calculate_context_window(
            agent_state=agent_state,
            actor=actor,
            token_counter=token_counter,
            message_manager=message_manager,
            system_message_compiled=system_msg,
            num_archival_memories=10,
            num_messages=5,
            message_ids=[],
        )

        # All sections should be populated
        assert result.num_tokens_system > 0
        assert result.num_tokens_core_memory > 0
        assert result.num_tokens_memory_filesystem > 0
        assert result.memory_filesystem is not None
        assert result.num_tokens_tool_usage_rules > 0
        assert result.tool_usage_rules is not None
        assert result.num_tokens_directories > 0
        assert result.directories is not None
        assert result.num_tokens_external_memory_summary > 0

        # Verify total is sum of all parts
        expected_total = (
            result.num_tokens_system
            + result.num_tokens_core_memory
            + result.num_tokens_memory_filesystem
            + result.num_tokens_tool_usage_rules
            + result.num_tokens_directories
            + result.num_tokens_external_memory_summary
            + result.num_tokens_summary_memory
            + result.num_tokens_messages
            + result.num_tokens_functions_definitions
        )
        assert result.context_window_size_current == expected_total

    @pytest.mark.asyncio
    async def test_calculate_context_window_git_enabled_agent(self):
        """Test that git-enabled agents capture bare file blocks as core_memory"""
        system_text = (
            "<base_instructions>Git agent</base_instructions>\n"
            "<memory_filesystem>\n"
            "\u251c\u2500\u2500 system/\n"
            "\u2502   \u251c\u2500\u2500 human.md\n"
            "\u2502   \u2514\u2500\u2500 persona.md\n"
            "</memory_filesystem>\n\n"
            "<system/human.md>\n---\ndescription: About the human\n---\nName: Alice\n</system/human.md>\n\n"
            "<system/persona.md>\n---\ndescription: Agent persona\n---\nI am helpful.\n</system/persona.md>\n\n"
            "<memory_metadata>Archival: 3 passages</memory_metadata>"
        )

        system_msg = _make_system_message(system_text)
        token_counter, message_manager, agent_state, actor = _make_mock_deps(system_text)

        calculator = ContextWindowCalculator()
        result = await calculator.calculate_context_window(
            agent_state=agent_state,
            actor=actor,
            token_counter=token_counter,
            message_manager=message_manager,
            system_message_compiled=system_msg,
            num_archival_memories=3,
            num_messages=5,
            message_ids=[],
        )

        # memory_filesystem should capture the tree view
        assert result.memory_filesystem is not None
        assert result.num_tokens_memory_filesystem > 0

        # core_memory should capture the bare file blocks
        assert result.num_tokens_core_memory > 0
        assert "Name: Alice" in result.core_memory
        assert "<system/persona.md>" in result.core_memory

        # Total should include all sections
        expected_total = (
            result.num_tokens_system
            + result.num_tokens_core_memory
            + result.num_tokens_memory_filesystem
            + result.num_tokens_tool_usage_rules
            + result.num_tokens_directories
            + result.num_tokens_external_memory_summary
            + result.num_tokens_summary_memory
            + result.num_tokens_messages
            + result.num_tokens_functions_definitions
        )
        assert result.context_window_size_current == expected_total
