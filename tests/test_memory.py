from types import SimpleNamespace

import pytest

from letta.constants import CORE_MEMORY_LINE_NUMBER_WARNING
from letta.schemas.block import Block, FileBlock
from letta.schemas.enums import AgentType
from letta.schemas.memory import ChatMemory, Memory


def make_source(id_: str, name: str, description: str | None = None, instructions: str | None = None):
    return SimpleNamespace(id=id_, name=name, description=description, instructions=instructions)


@pytest.fixture
def chat_memory():
    return ChatMemory(persona="Chat Agent", human="User")


def test_chat_memory_init_and_utils(chat_memory: Memory):
    assert chat_memory.get_block("persona").value == "Chat Agent"
    assert chat_memory.get_block("human").value == "User"
    assert set(chat_memory.list_block_labels()) == {"persona", "human"}


def test_get_block_not_found(chat_memory: Memory):
    with pytest.raises(KeyError):
        chat_memory.get_block("missing")


def test_update_block_value_type_error(chat_memory: Memory):
    with pytest.raises(ValueError):
        chat_memory.update_block_value("persona", 123)  # type: ignore[arg-type]


def test_update_block_value_success(chat_memory: Memory):
    chat_memory.update_block_value("human", "Hi")
    assert chat_memory.get_block("human").value == "Hi"


def test_compile_standard_blocks_metadata_and_values():
    m = Memory(
        agent_type=AgentType.memgpt_agent,
        blocks=[
            Block(label="persona", value="I am P", limit=100, read_only=True),
            Block(label="human", value="Hello", limit=100),
        ],
    )
    out = m.compile()
    assert "<memory_blocks>" in out
    assert "<persona>" in out and "</persona>" in out
    assert "<human>" in out and "</human>" in out
    assert "- read_only=true" in out
    assert "- chars_current=6" in out  # len("Hello")


def test_compile_line_numbered_blocks_sleeptime():
    m = Memory(agent_type=AgentType.sleeptime_agent, blocks=[Block(label="notes", value="line1\nline2", limit=100)])
    out = m.compile()
    assert "<memory_blocks>" in out
    # Without llm_config, should NOT show line numbers (backward compatibility)
    assert CORE_MEMORY_LINE_NUMBER_WARNING not in out
    assert "1→ line1" not in out and "2→ line2" not in out
    assert "line1" in out and "line2" in out  # Content should still be there


def test_compile_line_numbered_blocks_memgpt_v2():
    m = Memory(agent_type=AgentType.memgpt_v2_agent, blocks=[Block(label="notes", value="a\nb", limit=100)])
    out = m.compile()
    # Without llm_config, should NOT show line numbers (backward compatibility)
    assert "1→ a" not in out and "2→ b" not in out
    assert "a" in out and "b" in out  # Content should still be there


def test_compile_line_numbered_blocks_with_anthropic():
    """Test that line numbers appear when using Anthropic models."""
    from letta.schemas.llm_config import LLMConfig

    m = Memory(agent_type=AgentType.letta_v1_agent, blocks=[Block(label="notes", value="line1\nline2", limit=100)])
    anthropic_config = LLMConfig(model="claude-3-sonnet-20240229", model_endpoint_type="anthropic", context_window=200000)
    out = m.compile(llm_config=anthropic_config)
    assert "<memory_blocks>" in out
    assert CORE_MEMORY_LINE_NUMBER_WARNING in out
    assert "1→ line1" in out and "2→ line2" in out


def test_compile_line_numbered_blocks_with_openai():
    """Test that line numbers do NOT appear when using OpenAI models."""
    from letta.schemas.llm_config import LLMConfig

    m = Memory(agent_type=AgentType.letta_v1_agent, blocks=[Block(label="notes", value="line1\nline2", limit=100)])
    openai_config = LLMConfig(model="gpt-4", model_endpoint_type="openai", context_window=128000)
    out = m.compile(llm_config=openai_config)
    assert "<memory_blocks>" in out
    assert CORE_MEMORY_LINE_NUMBER_WARNING not in out
    assert "1→ line1" not in out and "2→ line2" not in out
    assert "line1" in out and "line2" in out  # Content should still be there


def test_compile_empty_returns_empty_string():
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[])
    assert m.compile() == ""


def test_tool_usage_rules_inclusion_and_order():
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[Block(label="a", value="b", limit=100)])
    rules = Block(label="tool_usage_rules", value="RVAL", description="RDESCR", limit=100)
    out = m.compile(tool_usage_rules=rules)
    assert "<tool_usage_rules>" in out
    assert "RDESCR" in out and "RVAL" in out
    assert out.index("</memory_blocks>") < out.index("<tool_usage_rules>")


def test_directories_common_includes_files_and_metadata():
    src = make_source("src1", "project", "Sdesc", "Sinst")
    fb = FileBlock(label="fileA", value="data", limit=100, file_id="f1", source_id="src1", is_open=True, read_only=True)
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[Block(label="x", value="y", limit=10)], file_blocks=[fb])
    out = m.compile(sources=[src], max_files_open=3)
    assert "<directories>" in out and "</directories>" in out
    assert "<file_limits>" in out
    assert "- current_files_open=1" in out and "- max_files_open=3" in out
    assert "<description>Sdesc</description>" in out
    assert "<instructions>Sinst</instructions>" in out
    assert 'name="fileA"' in out
    assert "- read_only=true" in out
    assert "<value>\ndata\n</value>" in out


def test_directories_common_omits_empty_value():
    src = make_source("src1", "project")
    fb = FileBlock(label="fileA", value="", limit=100, file_id="f1", source_id="src1", is_open=True)
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[], file_blocks=[fb])
    out = m.compile(sources=[src])
    assert "<directories>" in out
    assert "<value>" not in out  # omitted for empty value in common path


def test_directories_react_nested_label_and_status_counts():
    src = make_source("src1", "project")
    fb1 = FileBlock(label="fileA", value="content", limit=100, file_id="f1", source_id="src1", is_open=True)
    fb2 = FileBlock(label="fileB", value="", limit=100, file_id="f2", source_id="src1", is_open=True)
    m = Memory(agent_type=AgentType.react_agent, blocks=[Block(label="ignore", value="zz", limit=5)], file_blocks=[fb1, fb2])
    out = m.compile(sources=[src], max_files_open=5)
    assert "<memory_blocks>" not in out
    assert "<directories>" in out
    assert '<file status="open">' in out
    assert '<file status="closed">' in out
    assert "<fileA>" in out and "</fileA>" in out
    assert "- current_files_open=1" in out


def test_directories_file_limits_absent_when_none():
    src = make_source("src1", "project")
    fb = FileBlock(label="fileA", value="x", limit=100, file_id="f1", source_id="src1", is_open=True)
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[], file_blocks=[fb])
    out = m.compile(sources=[src], max_files_open=None)
    assert "<directories>" in out
    assert "<file_limits>" not in out


def test_agent_type_as_string_equivalent_behavior():
    src = make_source("src1", "project")
    m = Memory(agent_type="workflow_agent", blocks=[])
    out = m.compile(sources=[src])
    assert "<directories>" in out
    assert "<memory_blocks>" not in out


def test_file_blocks_duplicates_pruned_and_warning(caplog):
    caplog.clear()
    src = make_source("s", "n")
    fb1 = FileBlock(label="dup", value="a", limit=100, file_id="f1", source_id="s", is_open=True)
    fb2 = FileBlock(label="dup", value="b", limit=100, file_id="f2", source_id="s", is_open=True)
    with caplog.at_level("WARNING", logger="letta.schemas.memory"):
        m = Memory(agent_type=AgentType.memgpt_agent, blocks=[], file_blocks=[fb1, fb2])
    out = m.compile(sources=[src])
    assert caplog.records
    assert any("Duplicate block labels found" in r.message for r in caplog.records)
    assert out.count('name="dup"') == 1


@pytest.mark.asyncio
async def test_compile_async_matches_sync():
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[Block(label="a", value="b", limit=10)])
    assert await m.compile_async() == m.compile()


def test_prompt_template_deprecated_noop():
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[])
    m.set_prompt_template("foo")
    assert m.get_prompt_template() == "foo"


def test_sources_without_descriptions_or_instructions():
    src = make_source("src1", "project", None, None)
    fb = FileBlock(label="fileA", value="data", limit=100, file_id="f1", source_id="src1", is_open=True)
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[], file_blocks=[fb])
    out = m.compile(sources=[src])
    assert "<description>" not in out or "<description></description>" not in out
    assert "<instructions>" not in out


def test_read_only_metadata_in_file_and_block():
    src = make_source("src1", "project")
    fb = FileBlock(label="fileA", value="data", limit=100, file_id="f1", source_id="src1", is_open=True, read_only=True)
    m = Memory(agent_type=AgentType.memgpt_agent, blocks=[Block(label="x", value="y", limit=10, read_only=True)], file_blocks=[fb])
    out = m.compile(sources=[src])
    assert out.count("- read_only=true") >= 2


def test_current_files_open_counts_truthy_only():
    src = make_source("src1", "project")
    fb1 = FileBlock(label="fileA", value="data", limit=100, file_id="f1", source_id="src1", is_open=True)
    fb2 = FileBlock(label="fileB", value="", limit=100, file_id="f2", source_id="src1", is_open=False)
    fb3 = FileBlock(label="fileC", value="", limit=100, file_id="f3", source_id="src1", is_open=False)
    m = Memory(agent_type=AgentType.react_agent, blocks=[], file_blocks=[fb1, fb2, fb3])
    out = m.compile(sources=[src], max_files_open=10)
    assert "- current_files_open=1" in out


def test_compile_git_structured_core_memory_rendering():
    """Git-enabled agents should render persona in <self> and other system blocks in nested <memory> tags."""

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100, description="The human block"),
            Block(label="system/persona", value="persona data", limit=100, description="The persona block"),
        ],
    )

    out = m.compile()

    assert "<memory>" in out
    assert "<human>" in out
    assert "</human>" in out
    assert "human data" in out

    assert "<self>" in out
    assert "</self>" in out
    assert "<projection>$MEMORY_DIR/system/persona.md</projection>" in out
    assert "persona data" in out


def test_compile_git_structured_skills_section():
    """skills/ blocks should render in compile_available_skills() as filetree entries."""

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
            Block(
                label="skills/searching-messages",
                value="# searching messages",
                limit=100,
                description="Search past messages to recall context.",
            ),
            Block(
                label="skills/creating-skills",
                value="# creating skills",
                limit=100,
                description="Guide for creating effective skills.",
            ),
            Block(
                label="skills/creating-skills/references/workflows",
                value="nested docs",
                limit=100,
                description="Nested workflow docs (should not appear)",
            ),
        ],
    )

    out = m.compile_available_skills()

    assert "<available_skills>" in out
    assert "</available_skills>" in out

    # Top-level location and skill tree entries with descriptions
    assert "${MEMORY_DIR}/skills" in out
    assert "searching-messages/" in out
    assert "SKILL.md (Search past messages to recall context.)" in out
    assert "creating-skills/" in out
    assert "SKILL.md (Guide for creating effective skills.)" in out

    # Skill content should NOT be rendered (metadata only)
    assert "# searching messages" not in out
    assert "# creating skills" not in out

    # Nested skill files should NOT appear
    assert "references/workflows" not in out
    assert "Nested workflow docs" not in out


def test_compile_git_structured_archival_memory_section():
    """Non-system, non-skills blocks should render in <external_projection> as a file tree."""

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
            Block(label="notes", value="my notes", limit=100, description="Personal notes"),
            Block(label="reference/api", value="api specs", limit=100, description="API docs"),
        ],
    )

    out = m.compile()

    assert "<memory>" in out
    assert "<projection>$MEMORY_DIR/system/human.md</projection>" in out
    assert "<external_projection>" in out
    assert "${MEMORY_DIR}/" in out
    assert "reference/" in out
    assert "api.md" in out
    assert "notes.md" in out
    assert "${MEMORY_DIR}/reference/" not in out
    assert "${MEMORY_DIR}/notes.md" not in out

    # Descriptions are not rendered in the external tree.
    assert "Personal notes" not in out
    assert "API docs" not in out

    # Archival memory content should NOT be rendered
    assert "my notes" not in out
    assert "api specs" not in out


def test_compile_git_structured_client_skills():
    """client_skills should be merged with agent skills in compile_available_skills() as trees grouped by root."""
    from letta.schemas.letta_request import ClientSkillSchema

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
            Block(
                label="skills/searching-messages",
                value="# searching messages",
                limit=100,
                description="Search past messages.",
            ),
        ],
    )

    client_skills = [
        ClientSkillSchema(name="playwright-skill", description="Browser automation.", location="skills/playwright-skill/SKILL.md"),
        ClientSkillSchema(name="google", description="Google Workspace CLI.", location="skills/google/SKILL.md"),
    ]

    out = m.compile_available_skills(client_skills=client_skills)

    # All skills (agent + client) merged in <available_skills>
    assert "<available_skills>" in out
    assert "</available_skills>" in out

    # Agent skill present under memory skills root
    assert "${MEMORY_DIR}/skills" in out
    assert "searching-messages/" in out
    assert "SKILL.md (Search past messages.)" in out

    # Client skills grouped under their location roots
    assert "skills" in out
    assert "playwright-skill/" in out
    assert "SKILL.md (Browser automation.)" in out
    assert "google/" in out
    assert "SKILL.md (Google Workspace CLI.)" in out


def test_compile_git_structured_dedup_client_skills():
    """client_skills with the same name as agent skills should be deduplicated (agent wins)."""
    from letta.schemas.letta_request import ClientSkillSchema

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
            Block(label="skills/my-skill", value="skill", limit=100, description="Agent skill."),
        ],
    )

    client_skills = [
        ClientSkillSchema(name="my-skill", description="Client version of same skill.", location="skills/my-skill/SKILL.md"),
    ]

    out = m.compile_available_skills(client_skills=client_skills)

    # Agent skill present, client duplicate deduplicated
    assert "<available_skills>" in out
    assert "my-skill/" in out
    assert "SKILL.md" in out
    # Agent skill wins — description comes from agent block, not client
    assert "(Agent skill.)" in out
    # Only one entry for the skill (deduplicated)
    assert out.count("my-skill/") == 1


def test_compile_git_structured_client_skills_omits_empty_description_location_tags():
    """Client skills with blank description/location should still render name without empty suffix."""
    from letta.schemas.letta_request import ClientSkillSchema

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
        ],
    )

    client_skills = [
        ClientSkillSchema(name="blanky", description="", location=""),
    ]

    out = m.compile_available_skills(client_skills=client_skills)

    assert "<available_skills>" in out
    assert "blanky/" in out
    assert "SKILL.md" in out
    assert "SKILL.md ()" not in out


def test_compile_available_skills_standalone():
    """compile_available_skills() returns grouped file trees without recompiling the full prompt."""
    from letta.schemas.letta_request import ClientSkillSchema

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=100),
            Block(label="skills/my-skill", value="skill", limit=100, description="Agent skill."),
        ],
    )

    client_skills = [
        ClientSkillSchema(name="client-only", description="From client.", location="/tmp/client-only/SKILL.md"),
    ]

    result = m.compile_available_skills(client_skills=client_skills)

    assert "<available_skills>" in result
    assert "</available_skills>" in result
    # Agent skill present
    assert "my-skill/" in result
    assert "SKILL.md (Agent skill.)" in result
    # Client skill present
    assert "/tmp" in result
    assert "client-only/" in result
    assert "SKILL.md (From client.)" in result

    # No skills → empty string
    m_empty = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[Block(label="system/human", value="human data", limit=100)],
    )
    assert m_empty.compile_available_skills() == ""
    assert m_empty.compile_available_skills(client_skills=[]) == ""


def test_compile_does_not_include_available_skills():
    """compile() output should never persist request-scoped <available_skills> in system prompt storage."""

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=500),
            Block(
                label="system/project/notes",
                value="The `<available_skills>` section is request-scoped.",
                limit=500,
                description="Notes that reference <available_skills> as literal text.",
            ),
            Block(label="system/persona", value="persona data", limit=500),
        ],
    )

    out = m.compile()
    assert "\n<available_skills>\n" not in out
    assert "\n</available_skills>" not in out


def test_append_available_skills_preserves_blocks_with_literal_skills_text():
    """Appending request-scoped skills preserves blocks with literal tag references."""

    from letta.schemas.letta_request import ClientSkillSchema

    # Build a system prompt with blocks that contain literal skills XML text
    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=500),
            Block(
                label="system/project/workflow",
                value=(
                    "Structured MemFS rendering: flat top-level sections;\n"
                    "`<core_memory>`, `<archival_memory>`, `<available_skills>`;\n"
                    "`path` -> `location`; `ClientSkillSchema` on `LettaRequest`"
                ),
                limit=1000,
                description="Workflow notes.",
            ),
            Block(
                label="system/project/architecture",
                value=(
                    "`compile_available_skills()` returns the `<available_skills>...</available_skills>` string.\n"
                    "Request-scoped skills are appended at LLM request build time."
                ),
                limit=1000,
                description="Architecture notes.",
            ),
            Block(label="system/persona", value="persona data", limit=500),
        ],
    )

    client_skills = [
        ClientSkillSchema(name="test-skill", description="A test skill.", location="skills/test-skill/SKILL.md"),
    ]

    old_text = m.compile()
    new_skills = m.compile_available_skills(client_skills=client_skills)
    new_text = old_text.rstrip("\n") + "\n\n" + new_skills.lstrip("\n")

    # ALL blocks must survive the replacement
    assert "<memory>" in new_text
    assert "<human>" in new_text
    assert "<project>" in new_text
    assert "<workflow>" in new_text
    assert "<architecture>" in new_text
    assert "<self>" in new_text

    # Block content with literal text references must be preserved
    assert "`<available_skills>`" in new_text
    assert "`<available_skills>...</available_skills>`" in new_text

    # The structural <available_skills> block must be present at the end
    structural_start = new_text.rfind("\n<available_skills>\n")
    structural_end = new_text.find("</available_skills>", structural_start)
    assert structural_start > 0
    assert structural_end > structural_start
    assert "test-skill/" in new_text[structural_start:structural_end]
    assert "SKILL.md (A test skill.)" in new_text[structural_start:structural_end]


def test_compile_git_structured_recompile_after_block_edit():
    """Editing a block value should produce a different compile() output.

    This validates the mechanism behind system prompt recompilation: when a
    block is updated, the compiled memory string changes, which base_agent's
    rebuild_memory detects via substring mismatch against the current system
    message.
    """

    human_block = Block(label="system/human", value="original human data", limit=500, description="The human block")
    persona_block = Block(label="system/persona", value="original persona data", limit=500, description="The persona block")

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[human_block, persona_block],
    )

    out_before = m.compile()

    # Verify initial content renders
    assert "original human data" in out_before
    assert "original persona data" in out_before

    # Simulate a block edit (as would happen via the API)
    human_block.value = "updated human data with new info"
    out_after = m.compile()

    # Compiled output should have changed
    assert out_before != out_after

    # New value should appear, old value should not
    assert "updated human data with new info" in out_after
    assert "original human data" not in out_after

    # Unchanged block should still be present
    assert "original persona data" in out_after

    # The old compiled string should NOT be a substring of the new one
    # (this is the check base_agent uses to detect memory changes)
    assert out_before not in out_after


def test_compile_git_structured_recompile_after_block_label_change():
    """Changing a block label should produce a different compile() output.

    Label changes affect both the named section tag and the metadata index,
    so the system prompt must be recompiled.
    """

    block = Block(label="system/human", value="human data", limit=500, description="Human context")

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[block],
    )

    out_before = m.compile()
    assert "<human>" in out_before

    # Simulate label rename
    block.label = "system/user"
    out_after = m.compile()

    # Output should change: new tag name, new metadata
    assert out_before != out_after
    assert "<user>" in out_after
    assert "</user>" in out_after
    assert "<human>" not in out_after


def test_compile_git_structured_recompile_after_description_change():
    """Changing a block description should affect git-structured compile() output."""

    block = Block(label="system/human", value="human data", limit=500, description="Original description")

    m = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[block],
    )

    out_before = m.compile()
    assert "human data" in out_before

    # Simulate description edit
    block.description = "Updated description with more detail"
    out_after = m.compile()

    assert out_before != out_after
    assert "human data" in out_after
