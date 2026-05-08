import asyncio
import logging
import os
from datetime import datetime
from io import StringIO
from typing import List, Optional, Union

from letta.log import get_logger

logger = get_logger(__name__)

from openai.types.beta.function_tool import FunctionTool as OpenAITool
from pydantic import BaseModel, Field, field_validator

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT, CORE_MEMORY_LINE_NUMBER_WARNING
from letta.otel.tracing import trace_method
from letta.schemas.block import Block, FileBlock
from letta.schemas.enums import AgentType
from letta.schemas.file import FileStatus
from letta.schemas.message import Message


class ContextWindowOverview(BaseModel):
    """
    Overview of the context window, including the number of messages and tokens.
    """

    context_window_size_max: int = Field(..., description="The maximum amount of tokens the context window can hold.")
    context_window_size_current: int = Field(..., description="The current number of tokens in the context window.")

    num_messages: int = Field(..., description="The number of messages in the context window.")
    num_archival_memory: int = Field(..., description="The number of messages in the archival memory.")
    num_recall_memory: int = Field(..., description="The number of messages in the recall memory.")
    num_tokens_external_memory_summary: int = Field(
        ..., description="The number of tokens in the external memory summary (archival + recall metadata)."
    )
    external_memory_summary: str = Field(
        ..., description="The metadata summary of the external memory sources (archival + recall metadata)."
    )

    num_tokens_system: int = Field(..., description="The number of tokens in the system prompt.")
    system_prompt: str = Field(..., description="The content of the system prompt.")

    num_tokens_core_memory: int = Field(..., description="The number of tokens in the core memory.")
    core_memory: str = Field(..., description="The content of the core memory.")

    num_tokens_memory_filesystem: int = Field(
        0, description="The number of tokens in the memory filesystem section (git-enabled agents only)."
    )
    memory_filesystem: Optional[str] = Field(None, description="The content of the memory filesystem section.")

    num_tokens_tool_usage_rules: int = Field(0, description="The number of tokens in the tool usage rules section.")
    tool_usage_rules: Optional[str] = Field(None, description="The content of the tool usage rules section.")

    num_tokens_directories: int = Field(0, description="The number of tokens in the directories section (attached sources).")
    directories: Optional[str] = Field(None, description="The content of the directories section.")

    num_tokens_summary_memory: int = Field(..., description="The number of tokens in the summary memory.")
    summary_memory: Optional[str] = Field(None, description="The content of the summary memory.")

    num_tokens_functions_definitions: int = Field(..., description="The number of tokens in the functions definitions.")
    functions_definitions: Optional[List[OpenAITool]] = Field(..., description="The content of the functions definitions.")

    num_tokens_messages: int = Field(..., description="The number of tokens in the messages list.")
    messages: List[Message] = Field(..., description="The messages in the context window.")


class Memory(BaseModel, validate_assignment=True):
    """

    Represents the in-context memory (i.e. Core memory) of the agent. This includes both the `Block` objects (labelled by sections), as well as tools to edit the blocks.

    """

    agent_type: Optional[Union["AgentType", str]] = Field(None, description="Agent type controlling prompt rendering.")
    git_enabled: bool = Field(False, description="Whether this agent uses git-backed memory with structured labels.")
    blocks: List[Block] = Field(..., description="Memory blocks contained in the agent's in-context memory")
    file_blocks: List[FileBlock] = Field(
        default_factory=list, description="Special blocks representing the agent's in-context memory of an attached file"
    )

    @field_validator("file_blocks")
    @classmethod
    def validate_file_blocks_no_duplicates(cls, v: List[Block]) -> List[Block]:
        """Validate that file_blocks don't contain duplicate labels, log warnings and remove duplicates."""
        if not v:
            return v

        seen_labels = set()
        unique_blocks = []
        duplicate_labels = []

        for block in v:
            if block.label in seen_labels:
                duplicate_labels.append(block.label)
            else:
                seen_labels.add(block.label)
                unique_blocks.append(block)

        if duplicate_labels:
            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate block labels found in file_blocks: {duplicate_labels}. Removing duplicates.")

        return unique_blocks

    prompt_template: str = Field(default="", description="Deprecated. Ignored for performance.")

    def get_prompt_template(self) -> str:
        """Return the stored (deprecated) prompt template string."""
        return str(self.prompt_template)

    @trace_method
    def set_prompt_template(self, prompt_template: str):
        """Deprecated. Stores the provided string but is not used for rendering."""
        self.prompt_template = prompt_template

    @trace_method
    async def set_prompt_template_async(self, prompt_template: str):
        """Deprecated. Async setter that stores the string but does not validate or use it."""
        self.prompt_template = prompt_template

    def _get_renderable_blocks(self) -> list:
        """Return blocks that should be rendered into <memory_blocks>.

        For git-memory-enabled agents, only system/ blocks are rendered.
        For standard agents, all blocks are rendered.
        """
        if self.git_enabled:
            return [b for b in self.blocks if b.label and b.label.startswith("system/")]
        return list(self.blocks)

    def _display_label(self, label: str) -> str:
        """Return the XML tag name for a block label.

        For git-memory-enabled agents, strip the 'system/' prefix so
        system/human renders as <human>.
        """
        if self.git_enabled and label.startswith("system/"):
            return label.removeprefix("system/")
        return label

    @trace_method
    def _render_memory_blocks_standard(self, s: StringIO):
        renderable = self._get_renderable_blocks()
        if len(renderable) == 0:
            s.write("")
            return

        s.write("<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n")
        for idx, block in enumerate(renderable):
            label = self._display_label(block.label or "block")
            value = block.value or ""
            desc = block.description or ""
            chars_current = len(value)
            limit = block.limit if block.limit is not None else 0

            s.write(f"<{label}>\n")
            s.write("<description>\n")
            s.write(f"{desc}\n")
            s.write("</description>\n")
            s.write("<metadata>")
            if getattr(block, "read_only", False):
                s.write("\n- read_only=true")
            s.write(f"\n- chars_current={chars_current}")
            s.write(f"\n- chars_limit={limit}\n")
            s.write("</metadata>\n")
            s.write("<value>\n")
            s.write(f"{value}\n")
            s.write("</value>\n")
            s.write(f"</{label}>\n")
            if idx != len(renderable) - 1:
                s.write("\n")
        s.write("\n</memory_blocks>")

    def _render_memory_blocks_line_numbered(self, s: StringIO):
        renderable = self._get_renderable_blocks()
        s.write("<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n")
        for idx, block in enumerate(renderable):
            label = self._display_label(block.label or "block")
            value = block.value or ""
            desc = block.description or ""
            limit = block.limit if block.limit is not None else 0

            s.write(f"<{label}>\n")
            s.write("<description>\n")
            s.write(f"{desc}\n")
            s.write("</description>\n")
            s.write("<metadata>")
            if getattr(block, "read_only", False):
                s.write("\n- read_only=true")
            s.write(f"\n- chars_current={len(value)}")
            s.write(f"\n- chars_limit={limit}\n")
            s.write("</metadata>\n")
            s.write(f"<warning>\n{CORE_MEMORY_LINE_NUMBER_WARNING}\n</warning>\n")
            s.write("<value>\n")
            if value:
                for i, line in enumerate(value.split("\n"), start=1):
                    s.write(f"{i}→ {line}\n")
            s.write("</value>\n")
            s.write(f"</{label}>\n")
            if idx != len(renderable) - 1:
                s.write("\n")
        s.write("\n</memory_blocks>")

    def _render_memory_blocks_git(self, s: StringIO):
        """Render git-backed system memory with structured tags.

        - `system/persona` is rendered in a dedicated `<self>` section.
        - Other `system/*` blocks are rendered under `<memory>` with nested tags
          derived from their slash-separated labels (dropping the `system/`
          prefix).
        - Files outside `system/` and `skills/` are rendered under
          `<memory><external>...</external></memory>` as a file tree.
        """
        renderable = self._get_renderable_blocks()
        if not renderable:
            return

        s.write("\n\nReminder: <projection> contains the local path of the memory file projection.")

        # 1) Dedicated <self> section from system/persona
        persona_block = next((b for b in renderable if (b.label or "") == "system/persona"), None)
        if persona_block is not None:
            s.write("\n\n<self>\n")
            s.write("<projection>$MEMORY_DIR/system/persona.md</projection>\n")
            s.write((persona_block.value or "").rstrip("\n"))
            s.write("\n</self>")

        # 2) Render all other system/* blocks as nested tags under <memory>
        non_persona = [b for b in renderable if (b.label or "") != "system/persona"]
        external_blocks = [
            b
            for b in self.blocks
            if (b.label or "") and not (b.label or "").startswith("system/") and not (b.label or "").startswith("skills/")
        ]
        if not non_persona and not external_blocks:
            return

        LEAF_KEY = "__value__"
        LEAF_DESC_KEY = "__description__"
        LEAF_LABEL_KEY = "__label__"

        def _build_tree(blocks: list[Block], strip_prefix: str | None = None) -> dict:
            tree: dict = {}
            for block in blocks:
                label = block.label or ""
                if strip_prefix:
                    if not label.startswith(strip_prefix):
                        continue
                    label = label.removeprefix(strip_prefix)

                parts = [p for p in label.split("/") if p]
                if not parts:
                    continue

                node = tree
                for part in parts[:-1]:
                    if part not in node or not isinstance(node[part], dict):
                        node[part] = {}
                    node = node[part]

                leaf = parts[-1]
                leaf_node = node.get(leaf)
                desc = (block.description or "").strip()
                original_label = block.label or ""
                if leaf_node is None:
                    node[leaf] = {
                        LEAF_KEY: block.value or "",
                        LEAF_DESC_KEY: desc,
                        LEAF_LABEL_KEY: original_label,
                    }
                elif isinstance(leaf_node, dict):
                    leaf_node[LEAF_KEY] = block.value or ""
                    leaf_node[LEAF_DESC_KEY] = desc
                    leaf_node[LEAF_LABEL_KEY] = original_label
                else:
                    node[leaf] = {
                        LEAF_KEY: block.value or "",
                        LEAF_DESC_KEY: desc,
                        LEAF_LABEL_KEY: original_label,
                    }
            return tree

        system_tree = _build_tree(non_persona, strip_prefix="system/")

        def _render_nested(node: dict, indent: int = 0, path_parts: list[str] | None = None):
            pad = "  " * indent
            curr_parts = path_parts or []
            for key in sorted(k for k in node.keys() if k not in (LEAF_KEY, LEAF_DESC_KEY, LEAF_LABEL_KEY)):
                child = node[key]
                child_parts = [*curr_parts, key]
                s.write(f"{pad}<{key}>\n")
                if isinstance(child, dict):
                    if LEAF_KEY in child:
                        projection_path = "/".join(child_parts)
                        s.write(f"{pad}  <projection>$MEMORY_DIR/system/{projection_path}.md</projection>\n")

                    desc = str(child.get(LEAF_DESC_KEY) or "").rstrip("\n")
                    if desc:
                        s.write(f"{pad}  <description>{desc}</description>\n")
                    if LEAF_KEY in child:
                        value = str(child[LEAF_KEY] or "").rstrip("\n")
                        if value:
                            s.write(f"{pad}  {value}\n")
                    _render_nested(child, indent + 1, child_parts)
                s.write(f"{pad}</{key}>\n")

        s.write("\n\n<memory>\n")
        _render_nested(system_tree)

        # 3) External memory file tree (all files outside system/ and skills/)
        if external_blocks:
            s.write("<external_projection>\n")

            tree: dict = {}
            for block in sorted(external_blocks, key=lambda b: b.label or ""):
                label = (block.label or "").strip()
                if not label:
                    continue

                parts = [p for p in label.split("/") if p]
                if not parts:
                    continue

                node = tree
                for part in parts[:-1]:
                    node = node.setdefault(part, {})
                node[f"{parts[-1]}.md"] = None

            def _render_tree(node: dict, prefix: str = ""):
                dirs = sorted(k for k, v in node.items() if isinstance(v, dict))
                files = sorted(k for k, v in node.items() if v is None)
                entries = [(d, True) for d in dirs] + [(f, False) for f in files]

                for i, (name, is_dir) in enumerate(entries):
                    is_last = i == len(entries) - 1
                    connector = "└── " if is_last else "├── "
                    if is_dir:
                        s.write(f"{prefix}{connector}{name}/\n")
                        extension = "    " if is_last else "│   "
                        _render_tree(node[name], prefix + extension)
                    else:
                        s.write(f"{prefix}{connector}{name}\n")

            s.write("${MEMORY_DIR}/\n")
            _render_tree(tree)
            s.write("</external_projection>\n")

        s.write("</memory>")

    def _render_memory_filesystem(self, s: StringIO, client_skills=None):
        """Render a filesystem tree view of all memory blocks.

        Only rendered for git-memory-enabled agents. Uses box-drawing
        characters (├──, └──, │) like the Unix `tree` command, while keeping
        deterministic ordering (directories first, then files, alphabetically).
        """
        if not self.blocks and not client_skills:
            return

        # Build tree structure from block labels.
        #
        # IMPORTANT: labels are path-like (e.g. "system/human"). In real filesystems a
        # path component cannot be both a directory and a file, but our block namespace
        # can contain collisions like:
        #   - "system" (a block)
        #   - "system/human" (a block under a virtual "system/" directory)
        #
        # When we detect a collision, we convert the would-be directory node into a
        # dict and store the colliding leaf block under LEAF_KEY.
        LEAF_KEY = "__block__"

        tree: dict = {}
        for block in self.blocks:
            label = block.label or "block"
            parts = [p for p in label.split("/") if p]
            if not parts:
                parts = ["block"]

            node: dict = tree
            for part in parts[:-1]:
                existing = node.get(part)
                if existing is None:
                    node[part] = {}
                elif not isinstance(existing, dict):
                    # Collision: leaf at `part` and now we need it to be a directory.
                    node[part] = {LEAF_KEY: existing}
                node = node[part]  # type: ignore[assignment]

            leaf = parts[-1]
            existing_leaf = node.get(leaf)
            if existing_leaf is None:
                node[leaf] = block
            elif isinstance(existing_leaf, dict):
                # Collision: directory at `leaf` already exists; attach the leaf block.
                existing_leaf[LEAF_KEY] = block
            else:
                # Duplicate leaf label; last writer wins.
                node[leaf] = block

        s.write("\n\n<memory_filesystem>\n")

        def _render_tree(node: dict, prefix: str = "", in_system: bool = False, path_parts: tuple[str, ...] = ()):
            # Render skills/ as concise top-level entries only, using both
            # current (`skills/<name>`) and legacy (`skills/<name>/SKILL`) labels.
            if path_parts == ("skills",):
                skill_entries: list[tuple[str, str]] = []
                for name, val in node.items():
                    if name == LEAF_KEY:
                        continue

                    block = None
                    if isinstance(val, dict):
                        legacy_skill_block = val.get("SKILL")
                        if legacy_skill_block is not None and not isinstance(legacy_skill_block, dict):
                            block = legacy_skill_block
                        elif LEAF_KEY in val and not isinstance(val[LEAF_KEY], dict):
                            block = val[LEAF_KEY]
                    else:
                        block = val

                    if block is None:
                        continue

                    desc = getattr(block, "description", None)
                    desc_line = (desc or "").strip().split("\n")[0].strip()
                    skill_entries.append((name, desc_line))

                skill_entries.sort(key=lambda e: e[0])
                for i, (name, desc_line) in enumerate(skill_entries):
                    is_last = i == len(skill_entries) - 1
                    connector = "└── " if is_last else "├── "
                    desc_suffix = f" ({desc_line})" if desc_line else ""
                    s.write(f"{prefix}{connector}{name}{desc_suffix}\n")
                return

            # Sort: directories first, then files. If a node is both a directory and a
            # leaf (LEAF_KEY present), show both <name>/ and <name>.md.
            dirs = []
            files = []
            for name, val in node.items():
                if name == LEAF_KEY:
                    continue
                if isinstance(val, dict):
                    dirs.append(name)
                    if LEAF_KEY in val:
                        files.append(name)
                else:
                    files.append(name)

            dirs = sorted(dirs)
            files = sorted(files)
            entries = [(d, True) for d in dirs] + [(f, False) for f in files]

            for i, (name, is_dir) in enumerate(entries):
                is_last = i == len(entries) - 1
                connector = "└── " if is_last else "├── "
                if is_dir:
                    s.write(f"{prefix}{connector}{name}/\n")
                    extension = "    " if is_last else "│   "
                    _render_tree(
                        node[name],
                        prefix + extension,
                        in_system=in_system or name == "system",
                        path_parts=(*path_parts, name),
                    )
                else:
                    # For files outside system/, append the block description
                    desc_suffix = ""
                    if not in_system:
                        val = node[name]
                        block = val[LEAF_KEY] if isinstance(val, dict) else val
                        desc = getattr(block, "description", None)
                        if desc:
                            desc_line = desc.strip().split("\n")[0].strip()
                            if desc_line:
                                desc_suffix = f" ({desc_line})"
                    s.write(f"{prefix}{connector}{name}.md{desc_suffix}\n")

        _render_tree(tree)
        s.write("</memory_filesystem>")

    def compile_available_skills(self, client_skills=None) -> str:
        """Render the <available_skills> block from agent-scoped and client-provided skills.

        Returns the full string including leading newlines and XML tags, or an
        empty string if there are no skills to render.
        """
        all_skill_entries: list[tuple[str, str, str]] = []  # (name, description, location)
        seen_skill_names: set[str] = set()

        # Agent-scoped skills from memFS blocks.
        for block in self.blocks:
            label = block.label or ""
            if not label.startswith("skills/"):
                continue

            parts = label.split("/")
            if len(parts) < 2:
                continue

            skill_name = parts[1]
            # Only include top-level skill entries, skip nested files.
            is_top_level = len(parts) == 2 or (len(parts) == 3 and parts[2] == "SKILL")
            if not is_top_level or skill_name in seen_skill_names:
                continue

            seen_skill_names.add(skill_name)
            desc = (getattr(block, "description", None) or "").strip().split("\n")[0].strip()
            location = f"${{MEMORY_DIR}}/skills/{skill_name}/SKILL.md"
            all_skill_entries.append((skill_name, desc, location))

        # Client-provided skills.
        if client_skills:
            for cs in client_skills:
                name = cs.name
                if name in seen_skill_names:
                    continue

                seen_skill_names.add(name)
                desc = (cs.description or "").strip().split("\n")[0].strip()
                location = (cs.location or "").strip() or f"${{MEMORY_DIR}}/skills/{name}/SKILL.md"
                all_skill_entries.append((name, desc, location))

        if not all_skill_entries:
            return ""

        def _skill_root(skill_name: str, location: str) -> tuple[str, str]:
            norm = location.strip()
            if norm.endswith("/SKILL.md"):
                skill_dir = os.path.dirname(norm)
                root = os.path.dirname(skill_dir)
                rel = os.path.relpath(norm, root)
                if os.path.basename(skill_dir) == skill_name.split("/")[-1]:
                    return root, rel
            root = os.path.dirname(norm)
            rel = os.path.basename(norm)
            return root, rel

        grouped: dict[str, list[tuple[str, str]]] = {}
        for name, desc, location in all_skill_entries:
            root, relative_path = _skill_root(name, location)
            grouped.setdefault(root, []).append((relative_path, desc))

        s = StringIO()
        s.write("\n\n<available_skills>\n")

        root_paths = sorted(grouped.keys())
        for root_index, root in enumerate(root_paths):
            s.write(f"{root}\n")

            # Build a tree for each top-level location root.
            tree: dict = {}
            for rel_path, desc in sorted(grouped[root], key=lambda e: e[0]):
                parts = [p for p in rel_path.split("/") if p]
                if not parts:
                    continue

                node = tree
                for part in parts[:-1]:
                    node = node.setdefault(part, {})
                node[parts[-1]] = desc

            def _render_tree(node: dict, prefix: str = ""):
                dirs = sorted(k for k, v in node.items() if isinstance(v, dict))
                files = sorted(k for k, v in node.items() if isinstance(v, str))
                entries = [(d, True) for d in dirs] + [(f, False) for f in files]

                for i, (name, is_dir) in enumerate(entries):
                    is_last = i == len(entries) - 1
                    connector = "└── " if is_last else "├── "
                    if is_dir:
                        s.write(f"{prefix}{connector}{name}/\n")
                        extension = "    " if is_last else "│   "
                        _render_tree(node[name], prefix + extension)
                    else:
                        desc = (node[name] or "").strip()
                        desc_suffix = f" ({desc})" if desc else ""
                        s.write(f"{prefix}{connector}{name}{desc_suffix}\n")

            _render_tree(tree)
            if root_index != len(root_paths) - 1:
                s.write("\n")

        s.write("</available_skills>")
        return s.getvalue()

    def _render_directories_common(self, s: StringIO, sources, max_files_open):
        s.write("\n\n<directories>\n")
        if max_files_open is not None:
            current_open = sum(1 for b in self.file_blocks if getattr(b, "value", None))
            s.write("<file_limits>\n")
            s.write(f"- current_files_open={current_open}\n")
            s.write(f"- max_files_open={max_files_open}\n")
            s.write("</file_limits>\n")

        for source in sources:
            source_name = getattr(source, "name", "")
            source_desc = getattr(source, "description", None)
            source_instr = getattr(source, "instructions", None)
            source_id = getattr(source, "id", None)

            s.write(f'<directory name="{source_name}">\n')
            if source_desc:
                s.write(f"<description>{source_desc}</description>\n")
            if source_instr:
                s.write(f"<instructions>{source_instr}</instructions>\n")

            if self.file_blocks:
                for fb in self.file_blocks:
                    if source_id is not None and getattr(fb, "source_id", None) == source_id:
                        status = FileStatus.open.value if getattr(fb, "value", None) else FileStatus.closed.value
                        label = fb.label or "file"
                        desc = fb.description or ""
                        chars_current = len(fb.value or "")
                        limit = fb.limit if fb.limit is not None else 0

                        s.write(f'<file status="{status}" name="{label}">\n')
                        if desc:
                            s.write("<description>\n")
                            s.write(f"{desc}\n")
                            s.write("</description>\n")
                        s.write("<metadata>")
                        if getattr(fb, "read_only", False):
                            s.write("\n- read_only=true")
                        s.write(f"\n- chars_current={chars_current}\n")
                        s.write(f"- chars_limit={limit}\n")
                        s.write("</metadata>\n")
                        if getattr(fb, "value", None):
                            s.write("<value>\n")
                            s.write(f"{fb.value}\n")
                            s.write("</value>\n")
                        s.write("</file>\n")

            s.write("</directory>\n")
        s.write("</directories>")

    def _render_directories_react(self, s: StringIO, sources, max_files_open):
        s.write("\n\n<directories>\n")
        if max_files_open is not None:
            current_open = sum(1 for b in self.file_blocks if getattr(b, "value", None))
            s.write("<file_limits>\n")
            s.write(f"- current_files_open={current_open}\n")
            s.write(f"- max_files_open={max_files_open}\n")
            s.write("</file_limits>\n")

        for source in sources:
            source_name = getattr(source, "name", "")
            source_desc = getattr(source, "description", None)
            source_instr = getattr(source, "instructions", None)
            source_id = getattr(source, "id", None)

            s.write(f'<directory name="{source_name}">\n')
            if source_desc:
                s.write(f"<description>{source_desc}</description>\n")
            if source_instr:
                s.write(f"<instructions>{source_instr}</instructions>\n")

            if self.file_blocks:
                for fb in self.file_blocks:
                    if source_id is not None and getattr(fb, "source_id", None) == source_id:
                        status = FileStatus.open.value if getattr(fb, "value", None) else FileStatus.closed.value
                        label = fb.label or "file"
                        desc = fb.description or ""
                        chars_current = len(fb.value or "")
                        limit = fb.limit if fb.limit is not None else 0

                        s.write(f'<file status="{status}">\n')
                        s.write(f"<{label}>\n")
                        s.write("<description>\n")
                        s.write(f"{desc}\n")
                        s.write("</description>\n")
                        s.write("<metadata>")
                        if getattr(fb, "read_only", False):
                            s.write("\n- read_only=true")
                        s.write(f"\n- chars_current={chars_current}\n")
                        s.write(f"- chars_limit={limit}\n")
                        s.write("</metadata>\n")
                        s.write("<value>\n")
                        s.write(f"{fb.value or ''}\n")
                        s.write("</value>\n")
                        s.write(f"</{label}>\n")
                        s.write("</file>\n")

            s.write("</directory>\n")
        s.write("</directories>")

    def compile(self, tool_usage_rules=None, sources=None, max_files_open=None, llm_config=None, client_skills=None) -> str:
        """Efficiently render memory, tool rules, and sources into a prompt string."""
        s = StringIO()

        raw_type = self.agent_type.value if hasattr(self.agent_type, "value") else (self.agent_type or "")
        norm_type = raw_type.lower()
        is_react = norm_type in ("react_agent", "workflow_agent")

        # Check if we should use line numbers based on both agent type and model provider
        is_line_numbered = False  # Default to no line numbers
        if llm_config and hasattr(llm_config, "model_endpoint_type"):
            is_anthropic = llm_config.model_endpoint_type == "anthropic"
            is_line_numbered_agent_type = norm_type in ("sleeptime_agent", "memgpt_v2_agent", "letta_v1_agent")
            # Only use line numbers for specific agent types AND Anthropic models
            is_line_numbered = is_line_numbered_agent_type and is_anthropic

        # Memory blocks (not for react/workflow). Always include wrapper for preview/tests.
        if not is_react:
            if self.git_enabled:
                # Git-enabled: structured self + memory rendering
                self._render_memory_blocks_git(s)
            elif is_line_numbered:
                self._render_memory_blocks_line_numbered(s)
            else:
                self._render_memory_blocks_standard(s)

            # NOTE: available_skills is request-scoped and injected dynamically
            # by the agent at LLM request build time. It is intentionally NOT
            # persisted into compiled system prompt storage.

        if tool_usage_rules is not None:
            desc = getattr(tool_usage_rules, "description", None) or ""
            val = getattr(tool_usage_rules, "value", None) or ""
            s.write("\n\n<tool_usage_rules>\n")
            s.write(f"{desc}\n\n")
            s.write(f"{val}\n")
            s.write("</tool_usage_rules>")

        if sources:
            if is_react:
                self._render_directories_react(s, sources, max_files_open)
            else:
                self._render_directories_common(s, sources, max_files_open)

        return s.getvalue()

    @trace_method
    async def compile_async(self, tool_usage_rules=None, sources=None, max_files_open=None, llm_config=None, client_skills=None) -> str:
        """Async version that offloads to a thread for CPU-bound string building."""
        return await asyncio.to_thread(
            self.compile,
            tool_usage_rules=tool_usage_rules,
            sources=sources,
            max_files_open=max_files_open,
            llm_config=llm_config,
            client_skills=client_skills,
        )

    def list_block_labels(self) -> List[str]:
        """Return a list of the block names held inside the memory object"""
        return [block.label for block in self.blocks]

    def get_block(self, label: str) -> Block:
        """Correct way to index into the memory.memory field, returns a Block"""
        keys = []
        for block in self.blocks:
            if block.label == label:
                return block
            keys.append(block.label)
        raise KeyError(f"Block field {label} does not exist (available sections = {', '.join(keys)})")

    def get_blocks(self) -> List[Block]:
        """Return a list of the blocks held inside the memory object"""
        return self.blocks

    def set_block(self, block: Block):
        """Set a block in the memory object"""
        for i, b in enumerate(self.blocks):
            if b.label == block.label:
                self.blocks[i] = block
                return
        self.blocks.append(block)

    def update_block_value(self, label: str, value: str):
        """Update the value of a block"""
        if not isinstance(value, str):
            raise ValueError("Provided value must be a string")

        for block in self.blocks:
            if block.label == label:
                block.value = value
                return
        raise ValueError(f"Block with label {label} does not exist")


class BasicBlockMemory(Memory):
    """
    BasicBlockMemory is a basic implemention of the Memory class, which takes in a list of blocks and links them to the memory object. These are editable by the agent via the core memory functions.

    Attributes:
        memory (Dict[str, Block]): Mapping from memory block section to memory block.

    Methods:
        core_memory_append: Append to the contents of core memory.
        core_memory_replace: Replace the contents of core memory.
    """

    def __init__(self, blocks: List[Block] = []):
        """
        Initialize the BasicBlockMemory object with a list of pre-defined blocks.

        Args:
            blocks (List[Block]): List of blocks to be linked to the memory object.
        """
        super().__init__(blocks=blocks)

    def core_memory_append(agent_state: "AgentState", label: str, content: str) -> Optional[str]:  # type: ignore  # noqa: F821
        """
        Append to the contents of core memory.

        Args:
            label (str): Section of the memory to be edited.
            content (str): Content to write to the memory. All unicode (including emojis) are supported.

        Returns:
            Optional[str]: None is always returned as this function does not produce a response.
        """
        current_value = str(agent_state.memory.get_block(label).value)
        new_value = current_value + "\n" + str(content)
        agent_state.memory.update_block_value(label=label, value=new_value)
        return None

    def core_memory_replace(agent_state: "AgentState", label: str, old_content: str, new_content: str) -> Optional[str]:  # type: ignore  # noqa: F821
        """
        Replace the contents of core memory. To delete memories, use an empty string for new_content.

        Args:
            label (str): Section of the memory to be edited.
            old_content (str): String to replace. Must be an exact match.
            new_content (str): Content to write to the memory. All unicode (including emojis) are supported.

        Returns:
            Optional[str]: None is always returned as this function does not produce a response.
        """
        current_value = str(agent_state.memory.get_block(label).value)
        if old_content not in current_value:
            raise ValueError(f"Old content '{old_content}' not found in memory block '{label}'")
        new_value = current_value.replace(str(old_content), str(new_content))
        agent_state.memory.update_block_value(label=label, value=new_value)
        return None


class ChatMemory(BasicBlockMemory):
    """
    ChatMemory initializes a BaseChatMemory with two default blocks, `human` and `persona`.
    """

    def __init__(self, persona: str, human: str, limit: int = CORE_MEMORY_BLOCK_CHAR_LIMIT):
        """
        Initialize the ChatMemory object with a persona and human string.

        Args:
            persona (str): The starter value for the persona block.
            human (str): The starter value for the human block.
            limit (int): The character limit for each block.
        """
        super().__init__(blocks=[Block(value=persona, limit=limit, label="persona"), Block(value=human, limit=limit, label="human")])


class UpdateMemory(BaseModel):
    """Update the memory of the agent"""


class ArchivalMemorySummary(BaseModel):
    size: int = Field(..., description="Number of rows in archival memory")


class RecallMemorySummary(BaseModel):
    size: int = Field(..., description="Number of rows in recall memory")


class CreateArchivalMemory(BaseModel):
    text: str = Field(..., description="Text to write to archival memory.")
    tags: Optional[List[str]] = Field(None, description="Optional list of tags to attach to the memory.")
    created_at: Optional[datetime] = Field(None, description="Optional timestamp for the memory (defaults to current UTC time).")


class ArchivalMemorySearchResult(BaseModel):
    id: str = Field(..., description="Unique identifier of the archival memory passage")
    timestamp: str = Field(..., description="Timestamp of when the memory was created, formatted in agent's timezone")
    content: str = Field(..., description="Text content of the archival memory passage")
    tags: List[str] = Field(default_factory=list, description="List of tags associated with this memory")


class ArchivalMemorySearchResponse(BaseModel):
    results: List[ArchivalMemorySearchResult] = Field(..., description="List of search results matching the query")
    count: int = Field(..., description="Total number of results returned")
